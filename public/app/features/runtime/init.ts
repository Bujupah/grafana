import { CellValue, Workbook } from 'exceljs';
import saveAs from 'file-saver';
import JSZip from 'jszip';
import { takeWhile } from 'rxjs';

import {
  DataFrame,
  FieldType,
  LoadingState,
  PanelData,
  RawTimeRange,
  dateTimeFormat,
  formattedValueToString,
  getFieldDisplayName,
  systemDateFormats,
  toCSV,
} from '@grafana/data';
// import { config } from '@grafana/runtime';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';

import { buildImageUrl } from '../dashboard/components/ShareModal/utils';
import { DashboardModel, PanelModel } from '../dashboard/state';
// import { applyPanelTimeOverrides } from '../dashboard/utils/panel';
import { downloadDataFrameAsCsv } from '../inspector/utils/download';

declare global {
  interface Window {
    grafanaRuntime?: {
      getDashboardSaveModel: () => DashboardModel | undefined;
      getDashboardTimeRange: () => { from: number; to: number; raw: RawTimeRange };
      getPanelData: () => Record<number, PanelData | undefined> | undefined;

      downloadCsv: (..._: number[]) => Promise<any>;
      downloadZip: (..._: number[]) => Promise<any>;
      downloadXlsx: (..._: number[]) => Promise<any>;
    };
  }
}

/**
 * This will setup features that are accessible through the root window location
 *
 * This is useful for manipulating the application from external drivers like puppetter/cypress
 *
 * @internal and subject to change
 */
export function initWindowRuntime() {
  window.grafanaRuntime = {
    /** Get info for the current dashboard.  This will include the migrated dashboard JSON */
    getDashboardSaveModel: () => {
      const d = getDashboardSrv().getCurrent();
      if (!d) {
        return undefined;
      }
      return d.getSaveModelCloneOld();
    },

    /** The selected time range */
    getDashboardTimeRange: () => {
      const tr = getTimeSrv().timeRange();
      return {
        from: tr.from.valueOf(),
        to: tr.to.valueOf(),
        raw: tr.raw,
      };
    },

    /** Get the query results for the last loaded data */
    getPanelData: () => {
      const d = getDashboardSrv().getCurrent();
      if (!d) {
        return undefined;
      }
      return d.panels.reduce<Record<number, PanelData | undefined>>((acc, panel) => {
        acc[panel.id] = panel.getQueryRunner().getLastResult();
        return acc;
      }, {});
    },

    downloadZip: async (...ids: number[]) => {
      const d = getDashboardSrv().getCurrent();
      if (!d) {
        return undefined;
      }

      const zip = new JSZip();
      const panels = ids.length ? d.panels.filter((p) => ids.includes(p.id)) : d.panels;
      for (let i = 0; i < panels.length; i++) {
        const panel = d.panels[i];
        const dataFrame = await waitForData(d, panel);
        const fileName = `${i + 1}-${d.title}-data-${dateTimeFormat(new Date())}.csv`;
        zip.file(fileName, String.fromCharCode(0xfeff) + toCSV(dataFrame));
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const fileName = `${d.title}-${dateTimeFormat(new Date())}.zip`;
      saveAs(blob, fileName);
      return;
    },

    downloadCsv: async (...ids: number[]) => {
      const d = getDashboardSrv().getCurrent();
      if (!d) {
        return undefined;
      }
      const panels = ids.length ? d.panels.filter((p) => ids.includes(p.id)) : d.panels;
      for (let i = 0; i < panels.length; i++) {
        const panel = d.panels[i];
        const dataFrame = await waitForData(d, panel);
        downloadDataFrameAsCsv(dataFrame[0], panel.getDisplayTitle());
      }
      return;
    },
    downloadXlsx: async (...ids: number[]) => {
      const d = getDashboardSrv().getCurrent();
      if (!d) {
        return undefined;
      }
      const workbook = new Workbook();
      workbook.creator = 'Grafana';
      workbook.lastModifiedBy = 'Grafana';

      workbook.title = d.title;
      workbook.subject = 'Grafana Report';

      workbook.created = new Date();
      workbook.modified = new Date();
      workbook.lastPrinted = new Date();

      const panels = ids.length > 0 ? d.panels.filter((p) => ids.includes(p.id)) : d.panels;
      for (let i = 0; i < panels.length; i++) {
        const panel = d.panels[i];

        const sheet = workbook.addWorksheet(`${i + 1}-${panel.getDisplayTitle()}`, {
          properties: {
            defaultColWidth: 0.138 * 150, // 150 pixels
          },
        });

        if (panel.type !== 'table') {
          const imageUrl = buildImageUrl(true, d.uid, 'light', panel);
          const base64 = await imageResponseToBase64(imageUrl);
          const id = workbook.addImage({
            base64: base64 as any,
            extension: 'png',
          });
          sheet.addImage(id, {
            editAs: 'absolute',
            tl: { col: 0, row: 0 },
            ext: { width: 1000, height: 500 },
          });
          continue;
        }

        const result = await waitForData(d, panel);
        const data = toObject(result);

        sheet.columns = Object.keys(data).map((key) => {
          const value = data[key];
          return {
            key,
            header: value.name,
            numFmt: value.fmt,
            hidden: value.hidden,
            width: 0.138 * value.width,
          };
        });

        sheet.eachColumnKey((col, i) => {
          const value = data[`${i}`];
          if (value) {
            col.alignment = {
              vertical: 'middle',
              horizontal: value.align,
            };
            col.numFmt = value.fmt;
            col.font = { bold: true, name: 'Arial' };
            col.eachCell((cell) => {
              cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' },
              };
            });
          }
        });

        const keys = Object.keys(data);
        const max = keys.reduce((acc, key) => {
          const value = data[key];
          return Math.max(acc, value.data.length);
        }, 0);

        for (let i = 0; i < max; i++) {
          const rowData = keys.map((key) => {
            return data[key].data[i];
          });
          const row = sheet.addRow(rowData, 'i');
          row.eachCell((cell, colNumber) => {
            const colData = data[`${colNumber - 1}`];
            const cellData: DataCell = cell.value as any;
            cell.value = cellData.value;
            cell.font = {
              color: {
                argb: cellData.color?.replace('#', ''),
              },
            };
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: cellData.background?.replace('#', '') ?? 'FFFFFF' },
              bgColor: { argb: cellData.background?.replace('#', '') ?? 'FFFFFF' },
            };
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' },
            };
            cell.alignment = {
              horizontal: colData.align,
              vertical: 'middle',
            };
            if (cellData.link) {
              cell.value = {
                text: String(cellData.value),
                tooltip: cellData.link?.title,
                hyperlink: cellData.link?.href,
              };
            }
          });
          row.commit();
        }
      }

      const fileName = `${d.title}-${dateTimeFormat(new Date())}.xlsx`;

      const buffer = await workbook.xlsx.writeBuffer({ useStyles: true, useSharedStrings: true });
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, fileName);
      return;
    },
  };
}

const waitForData = async (dashboard: DashboardModel, panel: PanelModel): Promise<DataFrame[]> => {
  // const timeSrv = getTimeSrv();
  // const timeData = applyPanelTimeOverrides(panel, timeSrv.timeRange());

  return new Promise((resolve, reject) => {
    const subscriber = panel
      .getQueryRunner()
      .getData({ withFieldConfig: true, withTransforms: true })
      .pipe(takeWhile((next) => next.state !== LoadingState.Done, true))
      .subscribe((next) => {
        if (next.state === LoadingState.Done) {
          resolve(next.series);
        }
        if (next.state === LoadingState.Error) {
          console.error('Error loading data:', next.error);
          reject(next.errors);
        }
      });

    setTimeout(
      () => {
        subscriber.unsubscribe();
        reject('Timeout exceeded, no data received');
      },
      1000 * 60 * 5 // 5 minutes
    );

    if (!panel.hasRefreshed) {
      // Todo: Not needed I guess, test more scenarios and remove if not required since we disabled lazy loading for panels.
      // panel.runAllPanelQueries({
      //   dashboardUID: dashboard.uid,
      //   dashboardTimezone: dashboard.getTimezone(),
      //   width: panel.maxDataPoints ?? 560, // hmmm...
      //   timeData,
      //   publicDashboardAccessToken: config.publicDashboardAccessToken,
      // });
    }
  });
};

export type DataSheet = {
  [key: string]: DataColumn;
};

export type DataCell = {
  value: CellValue;
  link?: {
    title?: string;
    href: string;
  };
  color?: string;
  background?: string;
};

export type DataColumn = {
  name: string;
  data: DataCell[];
  hidden: boolean;
  align: 'left' | 'right' | 'center' | undefined;
  type: FieldType;
  fmt?: string;
  width: number;
};

export function toObject(data: DataFrame[]): DataSheet {
  if (!data) {
    return {};
  }

  const results: DataSheet = {};

  for (let s = 0; s < data.length; s++) {
    const series = data[s];
    const { fields } = series;

    // ignore frames with no fields
    if (fields.length === 0) {
      continue;
    }

    for (let i = 0; i < fields.length; i++) {
      const fieldName = getFieldDisplayName(fields[i], series);
      if (!results[fieldName]) {
        const fieldConfig = fields[i].config;

        let fmt: string | undefined = undefined;
        if (fields[i].type === FieldType.time) {
          const hasTime = fieldConfig.unit?.includes('time:');
          if (hasTime) {
            fmt = fieldConfig?.unit?.replace('time:', '');
          } else {
            fmt = systemDateFormats.fullDate;
            // Todo: in case of useBrowserLocale, should do something maybe :v
            // fmt = config.bootData.settings.dateFormats?.fullDate;
          }
        }

        results[`${i}`] = {
          name: fieldName,
          data: [],
          type: fields[i].type,
          hidden: fieldConfig.custom?.hidden ?? false,
          width: fieldConfig.custom.width ?? 150,
          align: fieldConfig.custom.align === 'auto' ? undefined : fieldConfig.custom.align,
          fmt: fmt,
        };
      }
    }

    const length = fields[0].values.length;

    if (length > 0) {
      for (let i = 0; i < length; i++) {
        for (let j = 0; j < fields.length; j++) {
          const v = fields[j].values[i];

          const cellValue: any = {
            value: undefined,
            link: undefined,
            color: undefined,
            background: undefined,
          };

          const diplay = fields[j].display?.(v);

          if (fields[j].type === FieldType.time) {
            cellValue.value = new Date(v);
          }

          if (fields[j].type === FieldType.number) {
            cellValue.value = Number(v);
          }

          if (fields[j].type === FieldType.boolean) {
            cellValue.value = Boolean(v);
          }

          if (fields[j].type === FieldType.string) {
            cellValue.value = diplay ? formattedValueToString(diplay) : v;
          }

          switch (fields[j].config.custom?.cellOptions?.type) {
            case 'color-text':
              cellValue.color = diplay?.color;
              break;
            case 'color-background':
              cellValue.color = getTextColor(diplay?.color);
              cellValue.background = diplay?.color;
              break;
          }

          // check for datalinks - only one hyperlink per cell
          // taking only the first one
          const links = fields[j].getLinks?.({ valueRowIndex: i }) ?? [];
          if (links.length > 0) {
            cellValue.link = {
              title: links[0].title,
              href: links[0].href,
            };
            // Not sure...
            cellValue.color = '#3B5586';
          }

          results[`${j}`].data.push(cellValue);
        }
      }
    }
  }

  return results;
}

function getTextColor(backgroundColor?: string): string | undefined {
  if (!backgroundColor) {
    return undefined;
  }

  if (backgroundColor.length === 4) {
    // Expand 3-digit hex color to 6-digit format
    backgroundColor = `#${backgroundColor[1]}${backgroundColor[1]}${backgroundColor[2]}${backgroundColor[2]}${backgroundColor[3]}${backgroundColor[3]}`;
  }

  // Convert hexadecimal background color to RGB
  const [, r, g, b] = backgroundColor.match(/^#(..)(..)(..)$/)!;
  const [rInt, gInt, bInt] = [parseInt(r, 16), parseInt(g, 16), parseInt(b, 16)];

  // Calculate relative luminance
  const luminance = (0.299 * rInt + 0.587 * gInt + 0.114 * bInt) / 255;

  // Determine text color based on luminance
  const textColor = luminance > 0.5 ? '000000' : 'FFFFFF';

  return textColor;
}

async function imageResponseToBase64(url: string): Promise<string> {
  const response = await fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    return response;
  });
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read image as base64'));
      }
    };
    reader.onerror = () => {
      reject(new Error('Failed to read image as base64'));
    };
    reader.readAsDataURL(blob);
  });
}
