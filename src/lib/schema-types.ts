/**
 * Schema.org JSON-LD Type Definitions (TypeScript)
 *
 * 목적: JSON-LD 구조화된 데이터의 타입 안전성 제공
 * 참고: https://schema.org
 *
 * 사용 예시:
 * ```typescript
 * const organization: Organization = { ... }
 * const product: Product = { ... }
 * ```
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 기본 타입들
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface BaseSchema {
  '@context': string;
  '@type': string;
}

/**
 * Person (개인)
 */
export interface Person extends BaseSchema {
  '@type': 'Person';
  name: string;
  url?: string;
  email?: string;
  telephone?: string;
  image?: string;
}

/**
 * PostalAddress (주소)
 */
export interface PostalAddress {
  '@type': 'PostalAddress';
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  postalCode: string;
  addressCountry: string;
}

/**
 * ContactPoint (연락처)
 */
export interface ContactPoint {
  '@type': 'ContactPoint';
  contactType: string; // "Customer Support", "Sales", etc.
  telephone: string;
  email?: string;
  areaServed?: string;
  availableLanguage?: string[];
}

/**
 * GeoCoordinates (지리 좌표)
 */
export interface GeoCoordinates {
  '@type': 'GeoCoordinates';
  latitude: number | string;
  longitude: number | string;
}

/**
 * OpeningHoursSpecification (영업 시간)
 */
export interface OpeningHoursSpecification {
  '@type': 'OpeningHoursSpecification';
  dayOfWeek: string | string[];
  opens: string; // HH:mm format
  closes: string; // HH:mm format
}

/**
 * Rating (평점)
 */
export interface Rating {
  '@type': 'Rating';
  ratingValue: number | string;
  bestRating?: number | string;
  worstRating?: number | string;
}

/**
 * AggregateRating (종합 평점)
 */
export interface AggregateRating {
  '@type': 'AggregateRating';
  ratingValue: number | string;
  ratingCount: number | string;
  bestRating?: number | string;
  worstRating?: number | string;
}

/**
 * Review (리뷰)
 */
export interface Review {
  '@type': 'Review';
  author: Person | { '@type': 'Person'; name: string };
  datePublished: string; // ISO 8601
  reviewRating: Rating;
  reviewBody: string;
  name?: string;
}

/**
 * Offer (제안/상품)
 */
export interface Offer {
  '@type': 'Offer';
  url: string;
  priceCurrency: string; // e.g., "KRW", "USD"
  price: string | number;
  priceValidUntil?: string;
  availability?: string; // "https://schema.org/InStock"
  seller: Organization | { '@type': 'Organization'; name: string };
}

/**
 * Brand (브랜드)
 */
export interface Brand {
  '@type': 'Brand';
  name: string;
  url?: string;
  logo?: string;
}

/**
 * ImageObject (이미지)
 */
export interface ImageObject {
  '@type': 'ImageObject';
  url: string;
  width?: number;
  height?: number;
  caption?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Organization (조직/회사)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface Organization extends BaseSchema {
  '@type': 'Organization';
  name: string;
  url?: string;
  logo?: string | ImageObject;
  description?: string;
  email?: string;
  telephone?: string;
  address?: PostalAddress;
  contactPoint?: ContactPoint | ContactPoint[];
  sameAs?: string[];
  founder?: Person | Person[];
  foundingDate?: string;
  knowsAbout?: string[];
  aggregateRating?: AggregateRating;
}

/**
 * LocalBusiness (지역 비즈니스)
 */
export interface LocalBusiness extends Omit<Organization, '@type'> {
  '@type': 'LocalBusiness';
  image?: string;
  geo?: GeoCoordinates;
  openingHoursSpecification?: OpeningHoursSpecification[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Product (상품)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface Product extends BaseSchema {
  '@type': 'Product';
  name: string;
  image?: string | string[] | ImageObject[];
  description?: string;
  url?: string;
  brand?: Brand | { '@type': 'Brand'; name: string };
  offers?: Offer | Offer[];
  aggregateRating?: AggregateRating;
  review?: Review | Review[];
  sku?: string;
  gtin?: string;
  manufacturer?: Organization;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Article (기사/블로그)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface Article extends BaseSchema {
  '@type': 'NewsArticle' | 'BlogPosting' | 'Article';
  headline: string;
  description?: string;
  image?: string | ImageObject[];
  datePublished: string; // ISO 8601
  dateModified: string; // ISO 8601
  author?: Person | Organization;
  publisher?: Organization;
  mainEntityOfPage?: { '@type': 'WebPage'; '@id': string };
  articleBody?: string;
  wordCount?: number;
  inLanguage?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Question/Answer (FAQ)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface Answer {
  '@type': 'Answer';
  text: string;
}

export interface Question {
  '@type': 'Question';
  name: string;
  acceptedAnswer: Answer;
}

export interface FAQPage extends BaseSchema {
  '@type': 'FAQPage';
  mainEntity: Question[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WebPage (웹 페이지)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface WebPage extends BaseSchema {
  '@type': 'WebPage';
  name: string;
  description?: string;
  url?: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  author?: Person | Organization;
  publisher?: Organization;
  mainEntity?: Product | Organization | Article | LocalBusiness;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Breadcrumb (빵 부스러기)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface BreadcrumbItem {
  '@type': 'ListItem';
  position: number;
  name: string;
  item: string;
}

export interface BreadcrumbList extends BaseSchema {
  '@type': 'BreadcrumbList';
  itemListElement: BreadcrumbItem[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Event (이벤트)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface Event extends BaseSchema {
  '@type': 'Event';
  name: string;
  description: string;
  startDate: string; // ISO 8601
  endDate?: string;
  location?: {
    '@type': 'Place';
    name: string;
    address?: PostalAddress;
    geo?: GeoCoordinates;
  };
  image?: string;
  offers?: Offer;
  organizer?: Organization;
  url?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Union Type: 모든 가능한 스키마
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type Schema =
  | Organization
  | LocalBusiness
  | Product
  | Article
  | FAQPage
  | WebPage
  | BreadcrumbList
  | Event;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 유틸리티 함수들
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * JSON-LD 스크립트 태그 생성 헬퍼
 */
export function createJsonLdScript<T extends Schema>(schema: T): string {
  return JSON.stringify(schema);
}

/**
 * 조직 스키마 빌더 (체이닝)
 */
export class OrganizationBuilder {
  private schema: Organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: '',
  };

  setName(name: string): this {
    this.schema.name = name;
    return this;
  }

  setUrl(url: string): this {
    this.schema.url = url;
    return this;
  }

  setLogo(logo: string): this {
    this.schema.logo = logo;
    return this;
  }

  setDescription(description: string): this {
    this.schema.description = description;
    return this;
  }

  setAddress(address: PostalAddress): this {
    this.schema.address = address;
    return this;
  }

  addContactPoint(contact: ContactPoint): this {
    if (!this.schema.contactPoint) {
      this.schema.contactPoint = [];
    }
    if (Array.isArray(this.schema.contactPoint)) {
      this.schema.contactPoint.push(contact);
    }
    return this;
  }

  setSameAs(urls: string[]): this {
    this.schema.sameAs = urls;
    return this;
  }

  build(): Organization {
    return this.schema;
  }
}

/**
 * 상품 스키마 빌더 (체이닝)
 */
export class ProductBuilder {
  private schema: Product = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: '',
  };

  setName(name: string): this {
    this.schema.name = name;
    return this;
  }

  setDescription(description: string): this {
    this.schema.description = description;
    return this;
  }

  setImage(image: string | string[]): this {
    this.schema.image = image;
    return this;
  }

  setUrl(url: string): this {
    this.schema.url = url;
    return this;
  }

  setBrand(brand: Brand): this {
    this.schema.brand = brand;
    return this;
  }

  addOffer(offer: Offer): this {
    if (!this.schema.offers) {
      this.schema.offers = [];
    }
    if (Array.isArray(this.schema.offers)) {
      this.schema.offers.push(offer);
    }
    return this;
  }

  setAggregateRating(rating: AggregateRating): this {
    this.schema.aggregateRating = rating;
    return this;
  }

  build(): Product {
    return this.schema;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 사용 예시
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/*
// 예시 1: Organization (직접)
const org: Organization = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: '마비즈 크루즈닷파트너스',
  url: 'https://mabizcruisedot.com',
  logo: 'https://mabizcruisedot.com/logo.png',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '서울시 강남구 테헤란로 123',
    addressLocality: '서울',
    addressRegion: 'Seoul',
    postalCode: '06000',
    addressCountry: 'KR',
  },
};

// 예시 2: Organization (빌더)
const org2 = new OrganizationBuilder()
  .setName('마비즈 크루즈닷파트너스')
  .setUrl('https://mabizcruisedot.com')
  .setLogo('https://mabizcruisedot.com/logo.png')
  .addContactPoint({
    '@type': 'ContactPoint',
    contactType: 'Customer Support',
    telephone: '+82-02-1234-5678',
  })
  .build();

// 예시 3: Product
const product = new ProductBuilder()
  .setName('크루즈 상품명')
  .setDescription('크루즈 상품 설명')
  .setImage('/product-image.jpg')
  .setUrl('https://mabizcruisedot.com/p/cruise-123')
  .setBrand({
    '@type': 'Brand',
    name: '크루즈닷',
  })
  .setAggregateRating({
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '1245',
  })
  .build();

// React/Next.js에서 사용:
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify(org),
  }}
/>
*/
