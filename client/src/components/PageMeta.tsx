import { useEffect } from 'react';

interface PageMetaProps {
  title?: string;
  description?: string;
}

/** Sets the page title and meta description for every route. */
export default function PageMeta({ title, description }: PageMetaProps) {
  useEffect(() => {
    const full = title ? `${title} · Robbiechaux Kicks` : 'Robbiechaux Kicks — Step in. Stand out.';
    document.title = full;
    if (description) {
      let tag = document.querySelector('meta[name="description"]');
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', 'description');
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', description);
    }
  }, [title, description]);

  return null;
}
