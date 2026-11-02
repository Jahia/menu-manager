import type { ReactNode } from "react";
import { AddResources, buildModuleFileUrl, buildNodeUrl, JImage, server, useGQLQuery } from "@jahia/javascript-modules-library";
import type { JCRNodeWrapper, JCRSessionWrapper } from "org.jahia.services.content";
import type { RenderContext, Resource } from "org.jahia.services.render";
import { useTranslation } from "react-i18next";
import { dependencyFor, depthOf, holdsCurrent, normalize, RESOLVED_MENU, type MenuItem, type ResolvedMenu } from "../../lib/menu.js";
import type { Props } from "./types.js";
import classes from "./navigation.module.css";

/**
 * What the views of mnu:navigation share. Not a view: each layout is a view of its own, one file
 * each (default = horizontal bar, mega, vertical, columns), chosen by the editor in Layout > Select a view
 * (j:view); they all resolve the menu here and draw items with the parts below.
 */

export const NS = "menu-manager-views";

export const cx = (...names: (string | false | undefined)[]): string => names.filter(Boolean).join(" ");

/** The context a view receives, the part of it the views read. */
export interface ViewContext {
  currentNode: JCRNodeWrapper;
  currentResource: Resource;
  renderContext: RenderContext;
  jcrSession: JCRSessionWrapper;
}

/** How an item points somewhere: its address, and the words read after a link opening a new tab. */
export interface Links {
  href: (item: MenuItem) => string | undefined;
  newTab: string;
}

/** A menu resolved for the visitor, ready to draw, or the edit-mode note that replaces it. */
export type Menu =
  | { ready: false; note: ReactNode }
  | {
      ready: true;
      items: MenuItem[];
      /** The nav's accessible name: the component's title, else a generic one. */
      label: string;
      /** Base of the ids the view gives its lists and panels. */
      base: string;
      edit: boolean;
      links: Links;
      /** The edit-mode note saying which menu this is (null outside edit mode). */
      info: ReactNode;
      /** The module's stylesheet. */
      styles: ReactNode;
      /** The script that opens dropdowns (null in edit mode, where every level is drawn open). */
      script: ReactNode;
      /** The image of a promotion, through JImage. */
      image: (imageId?: string | null, alt?: string | null) => ReactNode;
      /** The address of an item's promotion button. */
      promoLink: (item: MenuItem) => string | undefined;
    };

/**
 * A note shown in edit mode only (never preview or live), with a link that opens the menu in
 * jContent > Menus for the whole window (the edit frame is an iframe).
 */
const Note = ({ edit, text, link }: { edit: boolean; text: string; link?: { href: string; label: string } }) =>
  edit ? (
    <p className={classes.note} role="note" data-testid="mnu-note">
      {text}
      {link && (
        <>
          {" "}
          <a href={link.href} target="_top" className={classes.noteLink} data-testid="mnu-edit-link">
            {link.label}
          </a>
        </>
      )}
    </p>
  ) : null;

/**
 * jContent's Menus screen on a site and language, opened on one menu when given: the path of
 * jContent's own route, after the context path. Edit mode only, so the address of the request never
 * reaches a fragment visitors are served.
 */
const menusScreen = (renderContext: RenderContext, siteKey: string, language: string, menuPath?: string): string =>
  `${renderContext.getRequest().getContextPath()}/jahia/jcontent/${encodeURIComponent(siteKey)}/${encodeURIComponent(language)}/apps/menuManager` +
  (menuPath ? `?menu=${encodeURIComponent(menuPath)}` : "");

/**
 * Resolves the component's menu for the visitor (menuManager.resolvedMenu): items and targets the
 * visitor may not read are left out, labels fall back to the menu's fallback language, the current
 * page and its trail are marked. Declares the fragment's cache dependencies on the menu, its targets
 * and included subtrees: every view is cached per page (cache.mainResource) and per set of rights.
 */
export const useMenu = ({ "jcr:title": title, menu: menuNode, maxDepth }: Props, { currentNode, currentResource, renderContext, jcrSession }: ViewContext): Menu => {
  const { t } = useTranslation(NS);
  const edit = renderContext.isEditMode();
  const language = currentResource.getLocale().toString();
  // The menu's own site (a menu can come from another site), else the page's
  const siteKey = (menuNode ?? renderContext.getMainResource().getNode()).getResolveSite().getSiteKey();
  const link = edit
    ? { href: menusScreen(renderContext, siteKey, language, menuNode?.getPath()), label: t(menuNode ? "edit.editMenu" : "edit.openMenus") }
    : undefined;
  if (!menuNode) {
    return { ready: false, note: <Note edit={edit} text={t("edit.noMenu")} link={link} /> };
  }
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
    return { ready: false, note: <Note edit={edit} text={t("edit.unreadable")} /> };
  }
  for (const dependency of menu.dependencies) {
    server.render.addCacheDependency(dependencyFor(dependency), renderContext);
  }
  const menuTitle = menu.title ?? "";
  const items = normalize(menu.items);
  if (items.length === 0) {
    return { ready: false, note: <Note edit={edit} text={t("edit.empty", { title: menuTitle })} link={link} /> };
  }

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
  return {
    ready: true,
    items,
    label: title || t("nav.label"),
    base: `mnu-${currentNode.getIdentifier()}`,
    edit,
    links: { href, newTab: t("nav.newTab") },
    info: <Note edit={edit} text={t("edit.info", { title: menuTitle })} link={link} />,
    styles: <AddResources type="css" resources={buildModuleFileUrl("dist/assets/style.css")} />,
    script: edit ? null : <AddResources type="javascript" resources={buildModuleFileUrl("static/js/menu-manager.js")} key="mnu-script" />,
    image: (imageId, alt) => {
      if (!imageId) {
        return null;
      }
      try {
        return <JImage src={jcrSession.getNodeByIdentifier(imageId)} className={classes.promoImage} {...(alt ? { alt } : {})} />;
      } catch {
        return null;
      }
    },
    // The promotion's own link or address, else the item's link
    promoLink: (item) => {
      const promo = item.promotion;
      if (!promo) {
        return undefined;
      }
      return promo.url ?? (promo.targetId ? href({ ...item, url: null, targetId: promo.targetId }) : href(item));
    },
  };
};

const Chevron = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
    <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** One item: a link (marked when it is the current page), or a heading for a section or an item with no address. */
export const Entry = ({ item, className, links }: { item: MenuItem; className?: string; links: Links }) => {
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
export const Nested = ({ items, className, links }: { items: MenuItem[]; className?: string; links: Links }) => (
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
 * The bar of the horizontal and mega views: top items in a row, a disclosure button per item with
 * items (static/js/menu-manager.js shows and drives it; without it panels open on hover and focus),
 * and a menu button on small screens. `panel` draws what opens under a top item.
 */
export const Bar = ({
  menu,
  className,
  panelClass,
  panel,
}: {
  menu: Extract<Menu, { ready: true }>;
  className?: string;
  panelClass?: (item: MenuItem) => string;
  panel: (item: MenuItem) => ReactNode;
}) => {
  const { t } = useTranslation(NS);
  const { items, label, base, edit, links } = menu;
  return (
    <nav
      className={cx(classes.nav, classes.horizontal, className)}
      aria-label={label}
      data-mnu-nav=""
      data-edit={edit ? "" : undefined}
      data-testid="mnu-navigation"
    >
      {menu.styles}
      {menu.script}
      {menu.info}
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
            {item.children.length > 0 && (
              <div id={`${base}-panel-${i}`} className={cx(classes.panel, panelClass?.(item))} data-mnu-panel="">
                {panel(item)}
              </div>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
};
