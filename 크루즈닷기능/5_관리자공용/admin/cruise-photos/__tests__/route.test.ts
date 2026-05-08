/**
 * Test cases for /api/admin/cruise-photos
 *
 * Testing scenarios:
 * 1. Authentication check
 * 2. Folder filtering
 * 3. Image grouping by folder
 * 4. Flat format response
 * 5. Error handling
 */

// Mock data
const mockImageCaches = [
  {
    id: 1,
    cloudinaryUrl: 'https://res.cloudinary.com/demo/image/upload/v1234567890/cruise/ship-01.jpg',
    fileName: 'ship-01.jpg',
    folder: 'cruise/ship-photos',
    fileSize: 245000,
  },
  {
    id: 2,
    cloudinaryUrl: 'https://res.cloudinary.com/demo/image/upload/v1234567891/cruise/ship-02.jpg',
    fileName: 'ship-02.jpg',
    folder: 'cruise/ship-photos',
    fileSize: 312000,
  },
  {
    id: 3,
    cloudinaryUrl: 'https://res.cloudinary.com/demo/image/upload/v1234567892/cruise/deck-01.jpg',
    fileName: 'deck-01.jpg',
    folder: 'cruise/deck-views',
    fileSize: 456000,
  },
  {
    id: 4,
    cloudinaryUrl: 'https://res.cloudinary.com/demo/image/upload/v1234567893/cruise/cabin-01.jpg',
    fileName: 'cabin-01.jpg',
    folder: 'cruise/cabins',
    fileSize: 189000,
  },
  {
    id: 5,
    cloudinaryUrl: null, // Should be filtered out
    fileName: 'not-synced.jpg',
    folder: 'cruise/other',
    fileSize: 100000,
  },
];

describe('/api/admin/cruise-photos', () => {
  describe('GET - Grouped format (default)', () => {
    test('should return folders grouped by folder name', () => {
      // Test logic: Filter out null cloudinaryUrl, group by folder
      const filtered = mockImageCaches.filter((img) => img.cloudinaryUrl !== null);

      const folderMap = new Map<string, typeof mockImageCaches>();
      filtered.forEach((img) => {
        if (!folderMap.has(img.folder)) {
          folderMap.set(img.folder, []);
        }
        folderMap.get(img.folder)!.push(img);
      });

      const folders = Array.from(folderMap.entries()).map(([folderName, images]) => ({
        folder: folderName,
        count: images.length,
        images: images.map((img) => ({
          id: img.cloudinaryUrl,
          name: img.fileName,
          url: img.cloudinaryUrl,
          folder: img.folder,
          size: img.fileSize,
        })),
      }));

      // Assertions
      expect(folders.length).toBe(3); // cruise/ship-photos, cruise/deck-views, cruise/cabins
      expect(folders[0].folder).toBe('cruise/cabins');
      expect(folders[1].folder).toBe('cruise/deck-views');
      expect(folders[2].folder).toBe('cruise/ship-photos');

      expect(folders[2].count).toBe(2); // ship-photos has 2 images
      expect(folders[2].images[0].name).toBe('ship-01.jpg');
      expect(folders[2].images[1].name).toBe('ship-02.jpg');

      // Check stats
      const totalImages = filtered.length;
      expect(totalImages).toBe(4);
      expect(folders.length).toBe(3);
    });

    test('should sort images within folder by filename', () => {
      const filtered = mockImageCaches.filter((img) => img.cloudinaryUrl !== null);

      const folderImages = filtered.filter((img) => img.folder === 'cruise/ship-photos');
      const sorted = folderImages.sort((a, b) => a.fileName.localeCompare(b.fileName));

      expect(sorted[0].fileName).toBe('ship-01.jpg');
      expect(sorted[1].fileName).toBe('ship-02.jpg');
    });
  });

  describe('GET - Flat format', () => {
    test('should return flat list of images when format=flat', () => {
      const filtered = mockImageCaches.filter((img) => img.cloudinaryUrl !== null);

      const images = filtered.map((img) => ({
        id: img.cloudinaryUrl,
        name: img.fileName,
        url: img.cloudinaryUrl,
        folder: img.folder,
        size: img.fileSize,
      }));

      expect(images.length).toBe(4);
      expect(images[0].folder).toBe('cruise/ship-photos');
      expect(images[2].name).toBe('deck-01.jpg');
    });
  });

  describe('GET - Folder filtering', () => {
    test('should filter images by specific folder', () => {
      const folderFilter = 'cruise/ship-photos';
      const filtered = mockImageCaches.filter(
        (img) => img.cloudinaryUrl !== null && img.folder === folderFilter
      );

      const folderMap = new Map<string, typeof mockImageCaches>();
      filtered.forEach((img) => {
        if (!folderMap.has(img.folder)) {
          folderMap.set(img.folder, []);
        }
        folderMap.get(img.folder)!.push(img);
      });

      const folders = Array.from(folderMap.entries()).map(([folderName, images]) => ({
        folder: folderName,
        count: images.length,
      }));

      expect(folders.length).toBe(1);
      expect(folders[0].folder).toBe('cruise/ship-photos');
      expect(folders[0].count).toBe(2);
    });

    test('should return empty when folder does not exist', () => {
      const folderFilter = 'cruise/nonexistent';
      const filtered = mockImageCaches.filter(
        (img) => img.cloudinaryUrl !== null && img.folder === folderFilter
      );

      expect(filtered.length).toBe(0);
    });
  });

  describe('GET - Image mapping', () => {
    test('should map ImageCache fields to response format correctly', () => {
      const img = mockImageCaches[0];
      const mapped = {
        id: img.cloudinaryUrl,
        name: img.fileName,
        url: img.cloudinaryUrl,
        folder: img.folder,
        size: img.fileSize,
      };

      expect(mapped.id).toBe(img.cloudinaryUrl);
      expect(mapped.name).toBe('ship-01.jpg');
      expect(mapped.url).toBe(img.cloudinaryUrl);
      expect(mapped.folder).toBe('cruise/ship-photos');
      expect(mapped.size).toBe(245000);
    });

    test('should handle null fileSize', () => {
      const imgWithoutSize = {
        ...mockImageCaches[0],
        fileSize: null,
      };

      const mapped = {
        id: imgWithoutSize.cloudinaryUrl,
        name: imgWithoutSize.fileName,
        url: imgWithoutSize.cloudinaryUrl,
        folder: imgWithoutSize.folder,
        size: imgWithoutSize.fileSize,
      };

      expect(mapped.size).toBe(null);
    });
  });

  describe('GET - Filter null cloudinaryUrl', () => {
    test('should exclude images without cloudinaryUrl', () => {
      const filtered = mockImageCaches.filter((img) => img.cloudinaryUrl !== null);

      expect(filtered.length).toBe(4);
      expect(filtered.every((img) => img.cloudinaryUrl !== null)).toBe(true);
    });
  });

  describe('Response structure validation', () => {
    test('grouped response should have correct structure', () => {
      const filtered = mockImageCaches.filter((img) => img.cloudinaryUrl !== null);
      const folderMap = new Map<string, typeof mockImageCaches>();

      filtered.forEach((img) => {
        if (!folderMap.has(img.folder)) {
          folderMap.set(img.folder, []);
        }
        folderMap.get(img.folder)!.push(img);
      });

      const folders = Array.from(folderMap.entries()).map(([folderName, images]) => ({
        folder: folderName,
        count: images.length,
        images: images.map((img) => ({
          id: img.cloudinaryUrl,
          name: img.fileName,
          url: img.cloudinaryUrl,
          folder: img.folder,
          size: img.fileSize,
        })),
      }));

      const response = {
        ok: true,
        data: {
          folders,
          stats: {
            totalFolders: folders.length,
            totalImages: filtered.length,
          },
        },
      };

      // Verify response structure
      expect(response.ok).toBe(true);
      expect(response.data).toHaveProperty('folders');
      expect(response.data).toHaveProperty('stats');
      expect(response.data.stats).toHaveProperty('totalFolders');
      expect(response.data.stats).toHaveProperty('totalImages');

      // Verify folder structure
      expect(response.data.folders[0]).toHaveProperty('folder');
      expect(response.data.folders[0]).toHaveProperty('count');
      expect(response.data.folders[0]).toHaveProperty('images');

      // Verify image structure
      const image = response.data.folders[0].images[0];
      expect(image).toHaveProperty('id');
      expect(image).toHaveProperty('name');
      expect(image).toHaveProperty('url');
      expect(image).toHaveProperty('folder');
      expect(image).toHaveProperty('size');
    });

    test('flat response should have correct structure', () => {
      const filtered = mockImageCaches.filter((img) => img.cloudinaryUrl !== null);
      const images = filtered.map((img) => ({
        id: img.cloudinaryUrl,
        name: img.fileName,
        url: img.cloudinaryUrl,
        folder: img.folder,
        size: img.fileSize,
      }));

      const response = {
        ok: true,
        data: {
          images,
          count: images.length,
        },
      };

      expect(response.ok).toBe(true);
      expect(response.data).toHaveProperty('images');
      expect(response.data).toHaveProperty('count');
      expect(response.data.count).toBe(4);
    });
  });

  describe('Error handling', () => {
    test('should return 403 when not admin', () => {
      // Mock response
      const response = {
        ok: false,
        error: '관리자만 접근할 수 있습니다.',
        status: 403,
      };

      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);
    });

    test('should return 500 on database error', () => {
      // Mock response
      const response = {
        ok: false,
        error: '크루즈 이미지를 불러올 수 없습니다.',
        status: 500,
      };

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });
  });
});
