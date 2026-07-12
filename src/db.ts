/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CoachClipProject, Collection } from "./types";

const DB_NAME = "CoachClipDB";
const DB_VERSION = 1;

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains("projects")) {
        db.createObjectStore("projects", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("collections")) {
        db.createObjectStore("collections", { keyPath: "id" });
      }
    };
  });
}

export const dbService = {
  // --- Projects ---
  async getAllProjects(): Promise<CoachClipProject[]> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("projects", "readonly");
      const store = transaction.objectStore("projects");
      const request = store.getAll();

      request.onsuccess = () => {
        // Sort by updatedAt descending by default
        const projects = request.result as CoachClipProject[];
        projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        resolve(projects);
      };

      request.onerror = () => reject(request.error);
    });
  },

  async getProject(id: string): Promise<CoachClipProject | null> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("projects", "readonly");
      const store = transaction.objectStore("projects");
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => reject(request.error);
    });
  },

  async saveProject(project: CoachClipProject): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("projects", "readwrite");
      const store = transaction.objectStore("projects");
      
      // Ensure updated timestamp is fresh
      project.updatedAt = new Date().toISOString();
      const request = store.put(project);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async deleteProject(id: string): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("projects", "readwrite");
      const store = transaction.objectStore("projects");
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  // --- Collections ---
  async getAllCollections(): Promise<Collection[]> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("collections", "readonly");
      const store = transaction.objectStore("collections");
      const request = store.getAll();

      request.onsuccess = () => {
        const collections = request.result as Collection[];
        collections.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        resolve(collections);
      };

      request.onerror = () => reject(request.error);
    });
  },

  async getCollection(id: string): Promise<Collection | null> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("collections", "readonly");
      const store = transaction.objectStore("collections");
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  async saveCollection(collection: Collection): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("collections", "readwrite");
      const store = transaction.objectStore("collections");
      collection.updatedAt = new Date().toISOString();
      const request = store.put(collection);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async deleteCollection(id: string): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("collections", "readwrite");
      const store = transaction.objectStore("collections");
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};
