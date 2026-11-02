import type { JCRNodeWrapper } from "org.jahia.services.content";

export interface Props {
  "jcr:title"?: string;
  menu?: JCRNodeWrapper;
  layout?: "horizontal" | "vertical" | "columns";
  maxDepth?: number;
}
