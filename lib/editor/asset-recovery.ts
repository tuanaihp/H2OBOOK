import type { H2OBook, H2OElement, H2OPage } from "@/types/editor";

function fallbackPage(book: H2OBook, page: H2OPage, index: number) {
  return book.pages.find((candidate) => candidate.id === page.id)
    ?? book.pages.find((candidate) => candidate.name === page.name)
    ?? book.pages[index];
}

function fallbackElement(page: H2OPage | undefined, element: H2OElement, index: number) {
  return page?.elements.find((candidate) => candidate.id === element.id)
    ?? page?.elements.find((candidate) => candidate.type === element.type && candidate.name === element.name)
    ?? page?.elements[index];
}

/** Restores durable image references when an older cloud save retained page/element rows but
 *  dropped assetId. IDs are matched first; name/position are compatibility fallbacks for old data. */
export function mergeMissingBookAssetReferences(primary: H2OBook, fallback?: H2OBook | null): H2OBook {
  if (!fallback) return primary;
  let changed = false;
  const pages = primary.pages.map((page, pageIndex) => {
    const sourcePage = fallbackPage(fallback, page, pageIndex);
    const elements = page.elements.map((element, elementIndex) => {
      if (element.type !== "image") return element;
      const source = fallbackElement(sourcePage, element, elementIndex);
      if (!source || source.type !== "image") return element;
      const assetId = element.assetId || source.assetId;
      const imageUrl = element.imageUrl || (source.imageUrl?.startsWith("blob:") ? undefined : source.imageUrl);
      const imageMetadata = element.imageMetadata ?? source.imageMetadata;
      const altText = element.altText || source.altText;
      const caption = element.caption ?? source.caption;
      if (assetId === element.assetId && imageUrl === element.imageUrl && imageMetadata === element.imageMetadata && altText === element.altText && caption === element.caption) return element;
      changed = true;
      return { ...element, assetId, imageUrl, imageMetadata, altText, caption };
    });
    return elements.every((element, index) => element === page.elements[index]) ? page : { ...page, elements };
  });
  return changed ? { ...primary, pages } : primary;
}
