/**
 * Content URL 검증 함수 테스트
 */

import {
  validateContentUrl,
  isSafeContentUrl,
  validateContentUrls,
  filterSafeContentUrls,
} from './validate-content-url';

describe('validateContentUrl', () => {
  describe('✅ 허용되는 URL', () => {
    it('AWS S3 URL (표준 형식)', () => {
      const result = validateContentUrl('https://s3.amazonaws.com/bucket/file.png');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('https://s3.amazonaws.com/bucket/file.png');
      expect(result.error).toBeUndefined();
    });

    it('AWS S3 URL (지역별)', () => {
      const result = validateContentUrl('https://s3-us-west-2.amazonaws.com/mybucket/image.jpg');
      expect(result.valid).toBe(true);
    });

    it('AWS S3 URL (점 표기법)', () => {
      const result = validateContentUrl('https://s3.us-east-1.amazonaws.com/bucket/file.png');
      expect(result.valid).toBe(true);
    });

    it('Azure Blob Storage URL', () => {
      const result = validateContentUrl('https://myaccount.blob.core.windows.net/container/file.png');
      expect(result.valid).toBe(true);
    });

    it('Azure Blob Storage URL (zone-redundant)', () => {
      const result = validateContentUrl('https://myaccount.z6.blob.core.windows.net/container/file.png');
      expect(result.valid).toBe(true);
    });

    it('Azure Data Lake Storage URL', () => {
      const result = validateContentUrl('https://myaccount.dfs.core.windows.net/container/file.png');
      expect(result.valid).toBe(true);
    });

    it('HTTPS 프로토콜 사용 시', () => {
      const result = validateContentUrl('https://s3.amazonaws.com/bucket/file.png');
      expect(result.valid).toBe(true);
    });

    it('URL with query parameters', () => {
      const result = validateContentUrl('https://s3.amazonaws.com/bucket/file.png?version=1&size=large');
      expect(result.valid).toBe(true);
    });

    it('URL with fragments', () => {
      const result = validateContentUrl('https://s3.amazonaws.com/bucket/file.png#section');
      expect(result.valid).toBe(true);
    });
  });

  describe('❌ XSS 공격 차단', () => {
    it('javascript: 프로토콜', () => {
      const result = validateContentUrl('javascript:alert("xss")');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsafe protocol');
    });

    it('javascript: 프로토콜 (대문자)', () => {
      const result = validateContentUrl('JavaScript:alert("xss")');
      expect(result.valid).toBe(false);
    });

    it('data: URI with HTML', () => {
      const result = validateContentUrl('data:text/html,<script>alert("xss")</script>');
      expect(result.valid).toBe(false);
    });

    it('data: URI with base64', () => {
      const result = validateContentUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgnWFNTJyk8L3NjcmlwdD4=');
      expect(result.valid).toBe(false);
    });

    it('vbscript: 프로토콜', () => {
      const result = validateContentUrl('vbscript:msgbox("xss")');
      expect(result.valid).toBe(false);
    });

    it('Event handler attribute', () => {
      const result = validateContentUrl('https://s3.amazonaws.com/file.png" onload="alert(1)');
      expect(result.valid).toBe(false);
    });

    it('Embedded script tag', () => {
      const result = validateContentUrl('<script>alert("xss")</script>');
      expect(result.valid).toBe(false);
    });
  });

  describe('❌ SSRF 공격 차단', () => {
    describe('localhost 변형', () => {
      it('127.0.0.1', () => {
        const result = validateContentUrl('http://127.0.0.1:9200');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Private IP');
      });

      it('127.0.0.1 with path', () => {
        const result = validateContentUrl('http://127.0.0.1/admin');
        expect(result.valid).toBe(false);
      });

      it('localhost string', () => {
        const result = validateContentUrl('http://localhost:3000');
        expect(result.valid).toBe(false);
      });

      it('IPv6 loopback (::1)', () => {
        const result = validateContentUrl('http://[::1]:8080');
        expect(result.valid).toBe(false);
      });

      it('0.0.0.0', () => {
        const result = validateContentUrl('http://0.0.0.0');
        expect(result.valid).toBe(false);
      });
    });

    describe('Private IP ranges', () => {
      it('10.0.0.0/8', () => {
        const result = validateContentUrl('http://10.0.0.1');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Private IP');
      });

      it('10.x.x.x 범위', () => {
        const result = validateContentUrl('http://10.255.255.254');
        expect(result.valid).toBe(false);
      });

      it('192.168.0.0/16', () => {
        const result = validateContentUrl('http://192.168.1.1/admin');
        expect(result.valid).toBe(false);
      });

      it('172.16.0.0/12', () => {
        const result = validateContentUrl('http://172.16.0.1');
        expect(result.valid).toBe(false);
      });

      it('172.20.0.0/12 (Docker)', () => {
        const result = validateContentUrl('http://172.20.0.1');
        expect(result.valid).toBe(false);
      });

      it('172.31.0.0/12 (AWS VPC)', () => {
        const result = validateContentUrl('http://172.31.255.254');
        expect(result.valid).toBe(false);
      });

      it('169.254.0.0/16 (link-local)', () => {
        const result = validateContentUrl('http://169.254.169.254');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Private IP');
      });
    });

    describe('클라우드 메타데이터 서버', () => {
      it('AWS 메타데이터 서버', () => {
        const result = validateContentUrl('http://169.254.169.254/latest/meta-data/');
        expect(result.valid).toBe(false);
      });

      it('GCP 메타데이터 서버', () => {
        const result = validateContentUrl('http://metadata.google.internal');
        expect(result.valid).toBe(false);
      });

      it('Aliyun 메타데이터 서버', () => {
        const result = validateContentUrl('http://metadata.alibaba.com');
        expect(result.valid).toBe(false);
      });

      it('Azure 메타데이터 서버', () => {
        const result = validateContentUrl('http://local.metadata.azure.com');
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('❌ 잘못된 입력', () => {
    it('null 값', () => {
      const result = validateContentUrl(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });

    it('undefined 값', () => {
      const result = validateContentUrl(undefined);
      expect(result.valid).toBe(false);
    });

    it('빈 문자열', () => {
      const result = validateContentUrl('');
      expect(result.valid).toBe(false);
    });

    it('공백만 있는 문자열', () => {
      const result = validateContentUrl('   ');
      expect(result.valid).toBe(false);
    });

    it('유효하지 않은 URL 형식', () => {
      const result = validateContentUrl('not a url at all');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    it('FTP 프로토콜', () => {
      const result = validateContentUrl('ftp://example.com/file.txt');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsafe protocol');
    });

    it('file:// 프로토콜', () => {
      const result = validateContentUrl('file:///etc/passwd');
      expect(result.valid).toBe(false);
    });

    it('URL 너무 길음 (2083자 초과)', () => {
      const longUrl = 'https://s3.amazonaws.com/' + 'a'.repeat(2100);
      const result = validateContentUrl(longUrl);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });
  });

  describe('🔒 호스트명 검증', () => {
    it('호스트명 없음', () => {
      const result = validateContentUrl('https://');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Hostname');
    });

    it('유효한 S3 도메인', () => {
      const result = validateContentUrl('https://s3.amazonaws.com/bucket/file');
      expect(result.valid).toBe(true);
    });

    it('허용되지 않은 도메인', () => {
      const result = validateContentUrl('https://example.com/file.png');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Domain not allowed');
    });

    it('허용되지 않은 일반 도메인', () => {
      const result = validateContentUrl('https://cdn.example.com/file.png');
      expect(result.valid).toBe(false);
    });
  });

  describe('📝 공백 처리', () => {
    it('앞뒤 공백 제거', () => {
      const result = validateContentUrl('  https://s3.amazonaws.com/bucket/file.png  ');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('https://s3.amazonaws.com/bucket/file.png');
    });

    it('중간 공백은 실패', () => {
      const result = validateContentUrl('https://s3.amazonaws.com/bucket /file.png');
      expect(result.valid).toBe(false);
    });
  });
});

describe('isSafeContentUrl', () => {
  it('안전한 URL은 true 반환', () => {
    expect(isSafeContentUrl('https://s3.amazonaws.com/bucket/file.png')).toBe(true);
  });

  it('위험한 URL은 false 반환', () => {
    expect(isSafeContentUrl('javascript:alert("xss")')).toBe(false);
  });

  it('null은 false 반환', () => {
    expect(isSafeContentUrl(null)).toBe(false);
  });

  it('빈 문자열은 false 반환', () => {
    expect(isSafeContentUrl('')).toBe(false);
  });

  it('SSRF 공격은 false 반환', () => {
    expect(isSafeContentUrl('http://192.168.1.1')).toBe(false);
  });
});

describe('validateContentUrls (배치 검증)', () => {
  it('여러 URL을 배열로 검증', () => {
    const urls = [
      'https://s3.amazonaws.com/bucket/file1.png',
      'javascript:alert("xss")',
      'https://myaccount.blob.core.windows.net/container/file2.png',
      'http://127.0.0.1',
    ];

    const results = validateContentUrls(urls);
    expect(results).toHaveLength(4);
    expect(results[0].valid).toBe(true);
    expect(results[1].valid).toBe(false);
    expect(results[2].valid).toBe(true);
    expect(results[3].valid).toBe(false);
  });

  it('null 값 포함 처리', () => {
    const urls = ['https://s3.amazonaws.com/bucket/file.png', null, undefined];
    const results = validateContentUrls(urls);
    expect(results[0].valid).toBe(true);
    expect(results[1].valid).toBe(false);
    expect(results[2].valid).toBe(false);
  });
});

describe('filterSafeContentUrls', () => {
  it('안전한 URL만 필터링', () => {
    const urls = [
      'https://s3.amazonaws.com/bucket/file1.png',
      'javascript:alert("xss")',
      'https://myaccount.blob.core.windows.net/container/file2.png',
      'http://127.0.0.1',
      null,
    ];

    const safeUrls = filterSafeContentUrls(urls);
    expect(safeUrls).toHaveLength(2);
    expect(safeUrls[0]).toBe('https://s3.amazonaws.com/bucket/file1.png');
    expect(safeUrls[1]).toBe('https://myaccount.blob.core.windows.net/container/file2.png');
  });

  it('모든 URL이 위험한 경우 빈 배열 반환', () => {
    const urls = [
      'javascript:alert("xss")',
      'http://192.168.1.1',
      null,
    ];

    const safeUrls = filterSafeContentUrls(urls);
    expect(safeUrls).toHaveLength(0);
  });
});
