import { jahiaComponent } from "@jahia/javascript-modules-library";
import { cx, Nested, useMenu } from "./parts.js";
import type { Props } from "./types.js";
import classes from "./navigation.module.css";

/** A vertical list, every level shown, indented: a sidebar or a section's navigation. */
jahiaComponent(
  {
    componentType: "view",
    nodeType: "mnu:navigation",
    name: "vertical",
    displayName: "Vertical list",
    properties: { "cache.mainResource": "true" },
  },
  (props: Props, context) => {
    const menu = useMenu(props, context);
    if (!menu.ready) {
      return menu.note;
    }
    return (
      <nav className={cx(classes.nav, classes.vertical)} aria-label={menu.label} data-testid="mnu-navigation">
        {menu.styles}
        {menu.info}
        <Nested items={menu.items} className={classes.verticalList} links={menu.links} />
      </nav>
    );
  },
);
