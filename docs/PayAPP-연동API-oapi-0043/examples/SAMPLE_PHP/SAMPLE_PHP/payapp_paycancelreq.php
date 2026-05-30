<?php
//-------------------- 결제 취소 요청 --------------------//

/*************************************************************************/
/* payapp                                                                */
/* copyright ⓒ 2012 UDID. all rights reserved.                           */
/*                                                                       */
/* oapi sample                                                           */
/* - payapp 서버로 결제취소요청 정보를 전달합니다.                           */
/*                                                                       */
/*************************************************************************/

include("payapp_lib.php");
/*
TODO : 이곳에서 결제요청 정보를 불러옵니다.

ex) SELECT mul_no FROM payrequest WHERE orderno='1234567890'
*/

// 아래 입력정보를 알맞게 수정하세요.
// 판매자 사이트에 있는 연동KEY, 연동VALUE는 일반 사용자에게 노출이 되지 않도록 주의 하시기 바랍니다.
$postdata = array(
    'cmd'        => 'paycancelreq',               // 결제취소요청, 필수
    'userid'     => 'payapp 판매자 아이디',    // 판매자 아이디, 필수
    'linkkey'    => '연동KEY',                 // 연동KEY값, 필수 (판매자 사이트 로그인 후 설정 메뉴에서 확인 가능)
    // 아래 값을 고객사에 맞게 바꾸셔야 합니다.
    'mul_no'         => '1234',                    // 결제요청번호, 필수
    'cancelmemo'     => '품절되었습니다',          // 결제요청취소 메모
    'dpname'         => '',  // 입금자명
    'partcancel'     => '', // 결제취소요청구분
    'cancelprice'    => '', // 결제취소요청 금액
    'cancel_taxable' => '',
    'cancel_taxfree' => '',
    'cancel_vat'     => '',
);

$oResData = payapp_oapi_post($postdata);
if ($oResData['state'] == '1') {
    // 결제취소요청 성공
    // 결제취소요청는 즉시 실행됩니다.
    // 결제취소요청은 state='1' 로 성공해도 결제승인취소가 발생된 상태가 아닙니다. 이곳에서 주문취소 완료등을 실행하면 안됩니다.

    // $oResData['cr_dpname']
    // $oResData['partcancel']
    // $oResData['paybackprice'] // 취소반환금
    // $oResData['paybackbank']  // 취소반환금 입금계좌
    // $oResData['partprice']
    // $oResData['cancel_taxable']
    // $oResData['cancel_vat']
    // $oResData['cancel_taxfree']

    /*
    TODO : 이곳에서 결제취소요청 성공 정보를 저장합니다. 또는 feedbackurl 에서 처리하시기 바랍니다.

    ex) UPDATE payrequest SET cancel='y',cancel_date=NOW() WHERE orderno='1234567890'
    */
} else {
    // 결제취소요청
    // 오류메시지($oResData['errorMessage'])를 확인하고, 오류를 수정하셔야 합니다.
    /*
    $oResData['errorMessage'];	// 오류메시지
    $oResData['errno'];			// 오류코드
    */

    /*
    TODO : 이곳에서 결제취소요청 실패 정보를 저장하거나, 이전 페이지로 이동해서 다시 시도할 수 있도록 해야 합니다.

    ex) UPDATE payrequest SET errorMessage='{$oResData['errorMessage']}' WHERE orderno='1234567890'
    */
}

?>
