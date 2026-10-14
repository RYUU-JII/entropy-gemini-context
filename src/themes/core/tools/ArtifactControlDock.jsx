import React from 'react';
import { getInteractionMotionStyle } from '../motion/index.js';

function joinClasses(...parts) {
  return parts.filter(Boolean).join(' ');
}

const CONTROL_DOCK_INTERACTION_STYLE = getInteractionMotionStyle('stable');

const MODERN_VARIANT_STYLES = Object.freeze({
  default: Object.freeze({
    divider: 'border-border/18',
    drawerContent: 'pt-4 pr-1',
  }),
  cyberpunk: Object.freeze({
    divider: 'border-[#2a628a]/36',
    drawerContent: 'pt-4 pr-1',
  }),
  entropy: Object.freeze({
    divider: 'border-border/30',
    drawerContent: 'pt-4 pb-3 pr-1',
  }),
  zen: Object.freeze({
    divider: 'border-stone-300/70',
    drawerContent: 'pt-5 pr-1',
  }),
});

export default function ArtifactControlDock({
  SectionComponent = 'section',
  sectionProps = {},
  sectionClassName = '',
  containerClassName = '',
  model = null,
  variant = 'default',
}) {
  const DockSection = SectionComponent;
  const palette = MODERN_VARIANT_STYLES[variant] || MODERN_VARIANT_STYLES.default;
  const content = model?.content || null;
  const {
    className: sectionPropClassName = '',
    style: sectionPropStyle = null,
    ...restSectionProps
  } = sectionProps || {};

  if (!content) {
    return null;
  }

  return (
    <DockSection
      {...restSectionProps}
      data-artifact-control-dock="shell"
      data-artifact-control-dock-motion="none"
      className={joinClasses('border-t', palette.divider, sectionPropClassName, sectionClassName)}
      style={{
        ...CONTROL_DOCK_INTERACTION_STYLE,
        ...(sectionPropStyle || {}),
      }}
    >
      <div
        data-artifact-control-dock-frame="scroll-shell"
        className={joinClasses('relative flex h-full min-h-0 min-w-0 flex-col', containerClassName)}
      >
        <div
          data-artifact-control-dock-scroll="content"
          className={joinClasses('custom-scrollbar h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto', palette.drawerContent)}
        >
          {content}
        </div>
      </div>
    </DockSection>
  );
}
