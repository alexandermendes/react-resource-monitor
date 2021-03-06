import { useEffect } from 'react';

import { printWarning } from './print';

const noop = () => {};

/**
 * Check for duplicate resources being loaded.
 */
export const useResourceMonitor = typeof window === 'undefined' ? noop : ({
  initiatorTypes = ['script', 'link', 'css'],
  ignoreQuery = true,
  disable,
} = {}) => {
  if (typeof window.performance === 'undefined') {
    return;
  }

  if (typeof PerformanceObserver === 'undefined') {
    return;
  }

  if (disable) {
    return;
  }

  useEffect(() => {
    const resources = [];
    const reportedResources = [];

    /**
     * Check for duplicate resources and print a warning if any found.
     */
    const checkForDuplicates = (newEntries) => {
      resources.push(...newEntries);

      const resourcesByUrl = resources
        .filter(({ initiatorType }) => initiatorTypes.includes(initiatorType))
        .reduce((acc, entry) => {
          const url = new URL(entry.name);

          if (ignoreQuery) {
            url.search = '';
          }

          const { href } = url;

          return {
            ...acc,
            [href]: [
              ...(acc[href] || []),
              entry,
            ],
          };
        }, {});

      Object
        .entries(resourcesByUrl)
        .forEach(([url, entries]) => {
          if (entries.length < 2 || reportedResources.includes(url)) {
            return;
          }

          printWarning(`A ${entries[0].initiatorType} resource was loaded multiple times: ${url}`);

          reportedResources.push(url);
        });
    };

    // Check resources already loaded
    checkForDuplicates(performance.getEntriesByType('resource'));

    // Check any resources subsequently loaded
    const observer = new PerformanceObserver((list) => {
      checkForDuplicates(list.getEntries());
    });

    try {
      observer.observe({ entryTypes: ['resource'] });
    } catch (err) {
      // Contiue silently if `observe()` throws an error for any reason. There
      // seems for be a Webkit bug that throws for some browsers with the above
      // entryTypes (similar to https://phabricator.wikimedia.org/T217210)
    }

    return () => {
      observer.disconnect();
    };
  }, [initiatorTypes, ignoreQuery]);
};
