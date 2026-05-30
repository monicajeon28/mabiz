<?php
//-------------------- 판매자 회원 가입 --------------------//

/*************************************************************************/
/* payapp                                                                */
/* copyright ⓒ 2012 UDID. all rights reserved.                           */
/*                                                                       */
/* oapi sample                                                           */
/* - payapp 리셀러,판매자 회원가입.                                        */
/*                                                                       */
/*************************************************************************/

/*
페이앱 대리점,리셀러가
리셀러 또는 판매자를 가입 하는 연동입니다.
*/
include("payapp_lib.php");

// 아래 입력정보를 알맞게 수정하세요.
$postdata = array(
    'cmd'                => 'sellerRegist',   // 회원가입, 필수
    'userid'             => '',               // 판매자 아이디, 필수
    'userpwd'            => '',               // 판매자 비밀번호, 필수
    'sellername'         => '판매자명',       // 판매자명, 필수
    'phone'              => '01000000000',    // 판매자 휴대전화번호, 필수
    'compregno'          => '',               // 사업자등록번호 (사업자 필수)
    'compname'           => '',               // 상호명(법인명) (사업자 필수)
    'biztype1'           => '',               // 업태 (사업자 필수)
    'biztype2'           => '',               // 업종 (사업자 필수)
    'email'              => 'test@test.com',  // 이메일, 필수
    'zipcode'            => '',               // 우편번호
    'addr1'              => '',               // 주소1
    'addr2'              => '',               // 주소2
    'homepage'           => '',               // 홈페이지
    'compbank'           => '',               // 정산은행
    'compbanknum'        => '',               // 정산은행 계좌
    'compbankname'       => '',               // 정산은행 예금주
    'bizkind'            => '',               // 서비스구분 (Blog사업자,쇼핑몰사업자,방문판매,음식점(배달),A/S긴급출동,운수업,컨텐츠,도소매,유통,서비스,숙박업,임대업,농수산업,기타), 필수
    'username'           => '',               // 이름
    'usertype'           => '2',              // 판매자 구분 (사업자:2), 필수
    'resellerid'         => '',               // 대리점 또는 리셀러 아이디, 필수
    'join_type'          => '1',              // 가입형태 (유료:0, 할인:4), 필수
    'ceo_nm'             => '',               // 대표자 성함 (사업자 필수)
    'seller_type'        => 'seller',         // 가입 구분 (판매자:seller, 리셀러:reseller), 필수
    'common_feedbackurl' => '',               // 공통 feedbackurl
);

$oResData = payapp_oapi_post($postdata);
if ($oResData['state'] == '1') {
    // 가입성공
    /*
    $oResData['userid'];	// 판매자 아이디
    $oResData['linkkey'];	// 연동 KEY
    $oResData['linkval'];	// 연동 VALUE
    */
} else {
    // 가입실패
    // 실패메시지($oResData['errorMessage'])를 확인하고, 수정하고 재시도 하셔야 합니다.
    /*
    $oResData['errorMessage'];	// 오류메시지
    */
}


?>
