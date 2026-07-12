/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";

/**
 * Custom hook to safely manage Object URLs for files.
 * It automatically creates a single URL, revokes the previous URL on file change,
 * and revokes the URL on unmount to prevent browser memory leaks.
 */
export function useObjectUrl(file: File | null): string {
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }

    // Create unique URL for the current file
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);

    // Revoke URL on cleanup (file change or component unmount)
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file]);

  return url;
}
