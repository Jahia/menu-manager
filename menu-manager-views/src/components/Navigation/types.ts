import type { JCRNodeWrapper } from "org.jahia.services.content";

/** mnu:navigation; the layout is the view the editor picks (j:view), one view per layout. */
export interface Props {
  "jcr:title"?: string;
  menu?: JCRNodeWrapper;
  maxDepth?: number;
}
