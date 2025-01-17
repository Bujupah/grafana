import { Meta } from '@storybook/react';
import React from 'react';

import { StoryExample } from '../../utils/storybook/StoryExample';
import { VerticalGroup } from '../Layout/Layout';

import { Menu } from './Menu';
import mdx from './Menu.mdx';

const meta: Meta<typeof Menu> = {
  title: 'General/Menu',
  component: Menu,
  argTypes: {},
  parameters: {
    docs: {
      page: mdx,
    },
    knobs: {
      disabled: true,
    },
    controls: {
      disabled: true,
    },
    actions: {
      disabled: true,
    },
  },
};

export function Examples() {
  return (
    <VerticalGroup>
      <StoryExample name="Plain">
        <Menu>
          <Menu.Item label="Google" />
          <Menu.Item label="Filter" />
          <Menu.Item label="Active" active />
          <Menu.Item label="I am a link" url="http://google.com" target="_blank" />
          <Menu.Item label="With destructive prop set" destructive />
        </Menu>
      </StoryExample>
      <StoryExample name="With icons and a divider">
        <Menu>
          <Menu.Item label="Google" icon="search-plus" />
          <Menu.Item label="Filter" icon="filter" />
          <Menu.Item label="History" icon="history" />
          <Menu.Divider />
          <Menu.Item label="With destructive prop set" icon="trash-alt" destructive />
        </Menu>
      </StoryExample>
      <StoryExample name="With item menu description">
        <Menu>
          <Menu.Item label="item1" icon="history" description="item 1 is an important element" shortcut="q p" />
          <Menu.Item
            label="Item with a very long title"
            icon="apps"
            description="long titles can be hard to read"
            childItems={[
              <Menu.Item key="subitem1" label="subitem1" icon="history" />,
              <Menu.Item key="subitem2" label="subitem2" icon="apps" />,
              <Menu.Item
                key="subitem3"
                label="subitem3"
                icon="search-plus"
                childItems={[
                  <Menu.Item key="subitem1" label="subitem1" icon="history" />,
                  <Menu.Item key="subitem2" label="subitem2" icon="apps" />,
                  <Menu.Item key="subitem3" label="subitem3" icon="search-plus" />,
                ]}
              />,
            ]}
            shortcut="p s"
          />
          <Menu.Item
            label="item3"
            icon="filter"
            description="item 3 is an important element"
            childItems={[
              <Menu.Item key="subitem1" label="subitem1" icon="history" description="a subitem with a description" />,
              <Menu.Item key="subitem2" label="subitem2" icon="apps" />,
              <Menu.Item key="subitem3" label="subitem3" icon="search-plus" />,
            ]}
          />
        </Menu>
      </StoryExample>

      <StoryExample name="With disabled items">
        <Menu>
          <Menu.Item label="Google" icon="search-plus" />
          <Menu.Item label="Disabled action" icon="history" disabled />
          <Menu.Item label="Disabled link" icon="external-link-alt" url="http://google.com" target="_blank" disabled />
          <Menu.Item
            label="Submenu"
            icon="apps"
            childItems={[
              <Menu.Item key="subitem1" label="subitem1" icon="history" disabled />,
              <Menu.Item key="subitem2" label="subitem2" icon="apps" />,
            ]}
          />
          <Menu.Item
            label="Disabled submenu"
            icon="apps"
            disabled
            childItems={[
              <Menu.Item key="subitem1" label="subitem1" icon="history" />,
              <Menu.Item key="subitem2" label="subitem2" icon="apps" />,
            ]}
          />
          <Menu.Item label="Disabled destructive action" icon="trash-alt" destructive disabled />
        </Menu>
      </StoryExample>
      <StoryExample name="With submenu and shortcuts">
        <Menu>
          <Menu.Item label="item1" icon="history" shortcut="q p" />
          <Menu.Item
            label="Item with a very long title"
            icon="apps"
            childItems={[
              <Menu.Item key="subitem1" label="subitem1" icon="history" />,
              <Menu.Item key="subitem2" label="subitem2" icon="apps" />,
              <Menu.Item
                key="subitem3"
                label="subitem3"
                icon="search-plus"
                childItems={[
                  <Menu.Item key="subitem1" label="subitem1" icon="history" />,
                  <Menu.Item key="subitem2" label="subitem2" icon="apps" />,
                  <Menu.Item key="subitem3" label="subitem3" icon="search-plus" />,
                ]}
              />,
            ]}
            shortcut="p s"
          />
          <Menu.Item
            label="item3"
            icon="filter"
            childItems={[
              <Menu.Item key="subitem1" label="subitem1" icon="history" />,
              <Menu.Item key="subitem2" label="subitem2" icon="apps" />,
              <Menu.Item key="subitem3" label="subitem3" icon="search-plus" />,
            ]}
          />
        </Menu>
      </StoryExample>
    </VerticalGroup>
  );
}

export default meta;
