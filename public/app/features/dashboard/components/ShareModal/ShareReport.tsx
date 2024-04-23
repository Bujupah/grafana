import React, { PureComponent } from 'react';

import { Button, Field, Modal, RadioButtonGroup, Spinner, Switch } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { ShareModalTabProps } from './types';

interface Props extends ShareModalTabProps { }

interface State {
  reportType: 'csv' | 'xlsx';
  zipped?: boolean;
  loading: boolean;
}

export class ShareReport extends PureComponent<Props, State> {

  constructor(props: Props) {
    super(props);
    this.state = {
      reportType: 'csv',
      zipped: false,
      loading: false,
    };

  }

  onChangeZipped = () => {
    this.setState({
      zipped: !this.state.zipped,
    });
  }

  onDownload = async () => {
    this.setState({ ...this.state, loading: true })
    const { reportType, zipped } = this.state;
    if (reportType === 'csv') {
      if (zipped) {
        await window.grafanaRuntime?.downloadZip();
      } else {
        await window.grafanaRuntime?.downloadCsv();
      }
    } else {
      await window.grafanaRuntime?.downloadXlsx();
    }
    this.setState({ ...this.state, loading: false })
  }

  render() {
    const { onDismiss } = this.props;
    const { reportType, zipped, loading } = this.state;

    return (
      <>
        <p className="share-modal-info-text">
          <Trans i18nKey="share-modal.export.info-text">Download this dashboard.</Trans>
        </p>
        <Field label={'Report type'}>
          <RadioButtonGroup
            value={reportType}
            options={[
              {
                label: 'CSV',
                value: 'csv',
              },
              {
                label: 'XLSX',
                value: 'xlsx',
              }
            ]}
            onChange={(value) => this.setState({ reportType: value as 'csv' | 'xlsx' })}
            fullWidth
          />
        </Field>
        <Field label={'Zipped?'} disabled={reportType !== 'csv'}>
          <Switch id="download-as-zip" value={zipped} onChange={this.onChangeZipped} />
        </Field>
        <Modal.ButtonRow>
          <Button variant="secondary" onClick={onDismiss} fill="outline">
            <Trans i18nKey="share-modal.export.cancel-button">Cancel</Trans>
          </Button>
          <Button variant="secondary" onClick={this.onDownload} disabled={loading}>
            <Trans i18nKey="share-modal.export.download-button">&nbsp; Download &nbsp; {loading && <Spinner />} </Trans>
          </Button>
        </Modal.ButtonRow>
      </>
    );
  }
}
