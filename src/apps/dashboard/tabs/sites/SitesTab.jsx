import React from 'react';
import SitesManagementSurface from '../../workspaces/sites/SitesManagementSurface.jsx';

export { resolveSelectedSiteType } from '../../workspaces/sites/SitesManagementSurface.jsx';

export default function SitesTab(props) {
  return <SitesManagementSurface {...props} />;
}
