import { jahiaComponent } from "@jahia/javascript-modules-library";
import { Bar, Nested, useMenu } from "./parts.js";
import type { Props } from "./types.js";
import classes from "./navigation.module.css";

/**
 * The default view of a Menu: a horizontal bar whose top items open a dropdown of their items.
 * Edit mode draws every level open and says what the frame cannot show.
 */
jahiaComponent(
  {
    componentType: "view",
    nodeType: "mnu:navigation",
    displayName: "Horizontal bar",
    properties: { "cache.mainResource": "true" },
  },
  (props: Props, context) => {
    const menu = useMenu(props, context);
    if (!menu.ready) {
      return menu.note;
    }
    return <Bar menu={menu} panel={(item) => <Nested items={item.children} className={classes.panelList} links={menu.links} />} />;
  },
);
