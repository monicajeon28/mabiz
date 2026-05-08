import B2BLandingClient from './[partnerId]/B2BLandingClient';
import { DEFAULT_B2B_LANDING_TEMPLATE } from '../../lib/constants/b2b-landing-template';

export default async function B2BLandingPage() {
    // 항상 파일 템플릿 사용 (미니 클래스 마커 포함)
    const template = DEFAULT_B2B_LANDING_TEMPLATE;

    return <B2BLandingClient initialTemplate={template} />;
}
