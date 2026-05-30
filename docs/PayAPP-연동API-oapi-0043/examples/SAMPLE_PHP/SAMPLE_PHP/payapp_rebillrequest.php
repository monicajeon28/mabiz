<?php
//-------------------- 정기결제 요청 --------------------//

/*************************************************************************/
/* payapp                                                                */
/* copyright ⓒ 2012 UDID. all rights reserved.                           */
/*                                                                       */
/* oapi sample                                                           */
/* - payapp 서버로 정기결제 요청 정보를 전달합니다.                           */
/*                                                                       */
/*************************************************************************/

include("payapp_lib.php");
/*
TODO : 이곳에서 정기결제 요청 전 정보를 저장합니다.
ex) INSERT INTO rebillrequest (orderno,memberid,goodcode,goodname,goodprice) VALUES ('1234567890','kim','abcdefg','테스트상품',1000)
*/

// 정기결제 요청 정보
$postdata = array(
    'cmd'              => 'rebillRegist',         // 결제요청, 필수
    'userid'           => 'payapp 판매자 아이디', // 판매자 아이디, 필수

    'goodname'         => '테스트상품',           // 상품명, 필수
    'goodprice'        => '1000',                 // 결제요청 금액 (1,000원 이상), 필수
    'recvphone'        => '',                     // 수신자 휴대폰번호 (구매자), 필수
    'recvemail'        => '',                     // 수신자 이메일
    'memo'             => '결제요청 테스트',      // 결제요청시 메모
    'rebillCycleType'  => 'Month',                // 정기결제 주기 구분(Month: 매월, Week: 매주, Day: 매일), 필수
    'rebillCycleMonth' => '1',                    // 월 정기결제 결제일 (1~31,90:말일)
    'rebillCycleWeek'  => '',                     // 주 정기결제 결제요일 (1 ~ 7) 1:월요일 ~ 7:일요일
    'rebillExpire'     => '',                     // 정기결제 만료일 (yyyy-mm-dd), 필수
    'feedbackurl'      => 'http://고객사 도메인/oapi_sample/payapp_feedbackurl.php',        // 피드백 URL, feedbackurl은 외부에서 접근이 가능해야 합니다. payapp 서버에서 호출 하는 페이지 입니다.
    'var1'             => '1234567890',           // 임의변수1
    'var2'             => 'abcdefg',              // 임의변수2
                                                  // 임의변수는 고객사의 주문번호,상품코드 등 필요에 따라 자유롭게 이용이 가능합니다. feedbackurl로 값을 전달합니다.
    'smsuse'           => 'n',                    // 정기결제 요청 SMS 발송여부 ('n'인 경우 SMS 발송 안함)
    'openpaytype'      => '',                     // 결제 가능 수단 (휴대전화:phone, 신용카드:card) "," 구분 입력 (신용카드 & 휴대전화: card,phone)
                                                  // 판매자 사이트 "설정" 메뉴의 "결제 설정"이 우선 합니다.
);

$oResData = payapp_oapi_post($postdata);
if ($oResData['state'] == '1') {
	// 정기결제 요청 성공
	// 정기결제 요청번호($oResData['rebill_no'])를 고객사 DB에 저장해 놓으셔야 합니다.
	// 정기 결제 요청이 성공한 것으로 결제완료 상태가 아닙니다. 여기에서 상품배송/서비스 제공을 하면 안됩니다.
	// 결제완료는 feedbackurl에서만 확인이 가능합니다.
	/*
	$oResData['rebill_no'];	// 정기결제 요청번호
	$oResData['payurl'];	// 결제창 URL
	*/

	/*
	# TODO : 이곳에서 정기결제 요청 성공 정보를 저장합니다.
	ex) UPDATE rebillrequest SET rebill_no='{$oResData['rebill_no']}' WHERE orderno='1234567890'
	*/

    /*
    # TODO : 아래처럼 'payurl'로 페이지를 이동 하시면 정기결제 승인할 수 있는 페이지가 열립니다.
    echo <<<EOT
<script type="text/javascript">
location.href = '{$oResData['payurl']}';
</script>
EOT;
    */

} else {
	// 정기결제 요청 실패
	// 오류메시지($oResData['errorMessage'])를 확인하고, 오류를 수정하셔야 합니다.
	/*
	$oResData['errorMessage'];	// 오류메시지
	$oResData['errno'];			// 오류코드
	*/

	/*
	TODO : 이곳에서 정기결제 요청 실패 정보를 저장하거나, 이전 페이지로 이동해서 다시 시도할 수 있도록 해야 합니다.

	ex) UPDATE rebillrequest SET errorMessage='{$oResData['errorMessage']}' WHERE orderno='1234567890'
	*/
    /*
    echo <<<EOT
<script type="text/javascript">
alert('{$oResData['errorMessage']}');
window.close();
</script>
EOT;
    */
}


?>
