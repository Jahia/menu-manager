import {
  AddResources,
  buildModuleFileUrl,
  buildNodeUrl,
  JImage,
  jahiaComponent,
  server,
  useGQLQuery,
} from "@jahia/javascript-modules-library";
import { useTranslation } from "react-i18next";
import { dependencyFor, depthOf, holdsCurrent, normalize, RESOLVED_MENU, type MenuItem, type ResolvedMenu } from "../../lib/menu.js";
import type { Props } from "./types.js";
import classes from "./navigation.module.css";

const NS = "menu-manager-views";

const cx = (...names: (string | false | undefined)[]): string => names.filter(Boolean).join(" ");

const Chevron = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
    <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** How an item points somewhere: its address, and the words read after a link opening a new tab. */
interface Links {
  href: (item: MenuItem) => string | undefined;
  newTab: string;
}

/** One item: a link (marked when it is the current page), or a heading for a section or an item with no address. */
const Entry = ({ item, className, links }: { item: MenuItem; className?: string; links: Links }) => {
  const target = item.kind === "section" ? undefined : links.href(item);
  const styled = cx(className, item.style === "highlight" && classes.highlight, item.style === "button" && classes.button);
  if (!target) {
    return <span className={cx(styled, classes.section)}>{item.label}</span>;
  }
  return (
    <a
      href={target}
      className={cx(styled, classes.link, item.current && classes.current)}
      aria-current={item.current ? "page" : undefined}
      {...(item.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {item.label}
      {item.newTab && <span className={classes.srOnly}> {links.newTab}</span>}
    </a>
  );
};

/** Items and their own items, as nested lists. */
const Nested = ({ items, className, links }: { items: MenuItem[]; className?: string; links: Links }) => (
  <ul className={className}>
    {items.map((item) => (
      <li key={item.id} className={classes.nestedItem}>
        <Entry item={item} links={links} />
        {item.description && <span className={classes.description}>{item.description}</span>}
        {item.children.length > 0 && <Nested items={item.children} className={classes.deeper} links={links} />}
      </li>
    ))}
  </ul>
);

/**
 * A menu of jContent > Menus, resolved on the server for the visitor (menuManager.resolvedMenu):
 * items and targets the visitor may not read are left out, labels fall back to the menu's fallback
 * language, and the current page and its trail are marked. The fragment is cached per page (current
 * page) and per set of rights (Jahia's ACL key), and flushed when the menu, a target or an included
 * subtree changes. Four layouts: a horizontal bar with dropdowns (static/js/menu-manager.js opens
 * them; without it they open on hover and focus), a mega menu (the same bar, each top item opening a
 * full-width panel: the item and its description, then one column per child with its own items),
 * a vertical list, columns. Edit mode draws every
 * level open and says what the frame cannot show.
 */
jahiaComponent(
  {
    componentType: "view",
    nodeType: "mnu:navigation",
    displayName: "Menu",
    properties: { "cache.mainResource": "true" },
  },
  ({ "jcr:title": title, menu: menuNode, layout, maxDepth }: Props, { currentNode, currentResource, renderContext, jcrSession }) => {
    const { t } = useTranslation(NS);
    const edit = renderContext.isEditMode();
    const note = (text: string) =>
      edit ? (
        <p className={classes.note} role="note" data-testid="mnu-note">
          {text}
        </p>
      ) : null;
    if (!menuNode) {
      return note(t("edit.noMenu"));
    }

    const language = currentResource.getLocale().toString();
    const { data, errors } = useGQLQuery({
      query: RESOLVED_MENU,
      variables: {
        menu: menuNode.getIdentifier(),
        language,
        workspace: renderContext.getWorkspace() === "live" ? "LIVE" : "EDIT",
        currentPath: renderContext.getMainResource().getNode().getPath(),
        maxDepth: depthOf(maxDepth),
      },
    });
    const menu = (data as { menuManager?: { resolvedMenu?: ResolvedMenu | null } } | undefined)?.menuManager?.resolvedMenu;
    if (errors?.length || !menu) {
      return note(t("edit.unreadable"));
    }
    for (const dependency of menu.dependencies) {
      server.render.addCacheDependency(dependencyFor(dependency), renderContext);
    }
    const menuTitle = menu.title ?? "";
    const items = normalize(menu.items);
    if (items.length === 0) {
      return note(t("edit.empty", { title: menuTitle }));
    }

    const base = `mnu-${currentNode.getIdentifier()}`;
    const variant = layout === "vertical" || layout === "columns" || layout === "mega" ? layout : "horizontal";
    const href = (item: MenuItem): string | undefined => {
      if (item.url) {
        return item.url;
      }
      if (!item.targetId) {
        return undefined;
      }
      try {
        return buildNodeUrl(jcrSession.getNodeByIdentifier(item.targetId));
      } catch {
        return undefined;
      }
    };

    const links: Links = { href, newTab: t("nav.newTab") };
    /** The promotion's button: its own link or address, else the item's link. */
    const promoLink = (item: MenuItem): string | undefined => {
      const promo = item.promotion;
      if (!promo) {
        return undefined;
      }
      return promo.url ?? (promo.targetId ? href({ ...item, url: null, targetId: promo.targetId }) : href(item));
    };
    /** The promotion's image, through JImage (sizes, lazy loading); its own alt text, else the image's title. */
    const image = (imageId?: string | null, alt?: string | null) => {
      if (!imageId) {
        return null;
      }
      try {
        const node = jcrSession.getNodeByIdentifier(imageId);
        return <JImage src={node} className={classes.promoImage} {...(alt ? { alt } : {})} />;
      } catch {
        return null;
      }
    };
    const label = title || t("nav.label");
    const script = edit ? null : (
      <AddResources type="javascript" resources={buildModuleFileUrl("static/js/menu-manager.js")} key="mnu-script" />
    );
    const styles = <AddResources type="css" resources={buildModuleFileUrl("dist/assets/style.css")} />;
    const info = note(t("edit.info", { title: menuTitle }));

    if (variant === "horizontal" || variant === "mega") {
      const mega = variant === "mega";
      return (
        <nav
          className={cx(classes.nav, classes.horizontal, mega && classes.mega)}
          aria-label={label}
          data-mnu-nav=""
          data-edit={edit ? "" : undefined}
          data-testid="mnu-navigation"
        >
          {styles}
          {script}
          {info}
          {!edit && (
            <button type="button" className={classes.mobileToggle} aria-expanded="false" aria-controls={`${base}-list`} data-mnu-mobile="" hidden>
              {t("nav.toggle")}
            </button>
          )}
          <ul id={`${base}-list`} className={classes.bar}>
            {items.map((item, i) => (
              <li key={item.id} className={cx(classes.top, holdsCurrent(item) && classes.inTrail)} data-mnu-item="">
                <div className={classes.topRow}>
                  <Entry item={item} className={classes.topEntry} links={links} />
                  {item.children.length > 0 && !edit && (
                    <button
                      type="button"
                      className={classes.disclosure}
                      aria-expanded="false"
                      aria-controls={`${base}-panel-${i}`}
                      aria-label={t("nav.submenu", { label: item.label })}
                      data-mnu-toggle=""
                      hidden
                    >
                      <Chevron />
                    </button>
                  )}
                </div>
                {item.children.length > 0 && !mega && (
                  <div id={`${base}-panel-${i}`} className={classes.panel} data-mnu-panel="">
                    <Nested items={item.children} className={classes.panelList} links={links} />
                  </div>
                )}
                {item.children.length > 0 && mega && (
                  <div
                    id={`${base}-panel-${i}`}
                    className={cx(classes.panel, classes.megaPanel, item.promotion ? classes.megaWithPromo : undefined)}
                    data-mnu-panel=""
                  >
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
                        {image(item.promotion.imageId, item.promotion.imageAlt)}
                        <p className={classes.promoTitle}>{item.promotion.title}</p>
                        {item.promotion.text && <p className={classes.promoText}>{item.promotion.text}</p>}
                        {promoLink(item) && (
                          <a href={promoLink(item)} className={classes.promoButton}>
                            {item.promotion.linkLabel || item.label}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </nav>
      );
    }

    if (variant === "columns") {
      return (
        <nav className={cx(classes.nav, classes.columns)} aria-label={label} data-testid="mnu-navigation">
          {styles}
          {info}
          <ul className={classes.columnList}>
            {items.map((item) => (
              <li key={item.id} className={classes.column}>
                <Entry item={item} className={classes.columnHead} links={links} />
                {item.description && <span className={classes.description}>{item.description}</span>}
                {item.children.length > 0 && <Nested items={item.children} className={classes.columnItems} links={links} />}
              </li>
            ))}
          </ul>
        </nav>
      );
    }

    return (
      <nav className={cx(classes.nav, classes.vertical)} aria-label={label} data-testid="mnu-navigation">
        {styles}
        {info}
        <Nested items={items} className={classes.verticalList} links={links} />
      </nav>
    );
  },
);
