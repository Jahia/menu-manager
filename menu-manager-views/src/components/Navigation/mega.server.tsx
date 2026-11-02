import { jahiaComponent } from "@jahia/javascript-modules-library";
import { Bar, cx, Entry, Nested, useMenu } from "./parts.js";
import type { Props } from "./types.js";
import classes from "./navigation.module.css";

/**
 * A mega menu: the horizontal bar, each top item opening a panel the width of the menu with the item
 * and its description, one column per child with its own items, and the item's promotion (image,
 * title, text, button) when it has one.
 */
jahiaComponent(
  {
    componentType: "view",
    nodeType: "mnu:navigation",
    name: "mega",
    displayName: "Mega menu",
    properties: { "cache.mainResource": "true" },
  },
  (props: Props, context) => {
    const menu = useMenu(props, context);
    if (!menu.ready) {
      return menu.note;
    }
    const { links } = menu;
    return (
      <Bar
        menu={menu}
        className={classes.mega}
        panelClass={(item) => cx(classes.megaPanel, item.promotion ? classes.megaWithPromo : undefined)}
        panel={(item) => (
          <>
            <div className={classes.megaIntro}>
              <Entry item={item} className={classes.megaTitle} links={links} />
              {item.description && <p className={classes.megaDescription}>{item.description}</p>}
            </div>
            <ul className={classes.megaColumns}>
              {item.children.map((child) => (
                <li key={child.id} className={classes.megaColumn}>
                  <Entry item={child} className={classes.megaHead} links={links} />
                  {child.description && <span className={classes.description}>{child.description}</span>}
                  {child.children.length > 0 && <Nested items={child.children} className={classes.megaItems} links={links} />}
                </li>
              ))}
            </ul>
            {item.promotion && (
              <div className={classes.promo} data-testid="mnu-promotion">
                {menu.image(item.promotion.imageId, item.promotion.imageAlt)}
                <p className={classes.promoTitle}>{item.promotion.title}</p>
                {item.promotion.text && <p className={classes.promoText}>{item.promotion.text}</p>}
                {menu.promoLink(item) && (
                  <a href={menu.promoLink(item)} className={classes.promoButton}>
                    {item.promotion.linkLabel || item.label}
                  </a>
                )}
              </div>
            )}
          </>
        )}
      />
    );
  },
);
