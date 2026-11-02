import { jahiaComponent } from "@jahia/javascript-modules-library";
import { cx, Entry, Nested, useMenu } from "./parts.js";
import type { Props } from "./types.js";
import classes from "./navigation.module.css";

/** Columns, one per top item with its items under it: a footer or a site map. */
jahiaComponent(
  {
    componentType: "view",
    nodeType: "mnu:navigation",
    name: "columns",
    displayName: "Columns",
    properties: { "cache.mainResource": "true" },
  },
  (props: Props, context) => {
    const menu = useMenu(props, context);
    if (!menu.ready) {
      return menu.note;
    }
    const { links } = menu;
    return (
      <nav className={cx(classes.nav, classes.columns)} aria-label={menu.label} data-testid="mnu-navigation">
        {menu.styles}
        {menu.info}
        <ul className={classes.columnList}>
          {menu.items.map((item) => (
            <li key={item.id} className={classes.column}>
              <Entry item={item} className={classes.columnHead} links={links} />
              {item.description && <span className={classes.description}>{item.description}</span>}
              {item.children.length > 0 && <Nested items={item.children} className={classes.columnItems} links={links} />}
            </li>
          ))}
        </ul>
      </nav>
    );
  },
);
