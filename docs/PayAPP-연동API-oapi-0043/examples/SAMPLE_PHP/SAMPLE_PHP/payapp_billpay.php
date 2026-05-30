<?php
//-------------------- 등록결제 결제 --------------------//

/*************************************************************************/
/* payapp                                                                */
/* copyright ⓒ 2019 UDID. all rights reserved.                           */
/*                                                                       */
/* oapi sample                                                           */
/* - payapp 서버로 결제정보 를 전달합니다.                           */
/*                                                                       */
/*************************************************************************/

include("payapp_lib.php");
/*
TODO : 이곳에서 등록결제 결제를 실행합니다.
*/

// 등록결제 결제
// 업체에 맞게 수정하세요.
$postdata = array(
    'cmd' => 'billPay',             // 결제, 필수
    'userid' => '판매자아이디',       // 판매자 아이디, 필수
    'encBill' => '등록결제 등록번호', // 등록결제키 필수
    'goodname' => '1000원',         // 상품이름 필수
    'price' => '1000',              // 상품가격 필수
    'recvphone' => '구매자전화번호',  // 구매자 전화번호  필수
    'amount_taxable' => '공급가액',  // 공급가액
    'amount_taxfree' => '면세금액',  // 면세금액
    'amount_vat' => '부가세',        // 부가세
    'feedbackurl' => '공통통보url',  // 결제완료 후 결과값을 리턴받을 고객사 URL
    'var1' => '사용자 임의 변수 1',   // 사용자 임의 변수 1
    'var2' => '사용자 임의 변수 2',   // 사용자 임의 변수 2
    'checkretry' => 'y',            // feedbackurl 재시도 (y:재시도,n:재시도 안함)
    'cardinst' => '',               // 카드할부 개월 수 ('00','01','02'....)
);

$oResData = payapp_oapi_post($postdata);
if ($oResData['state']=='1') {
    /*
     * 결제 성공
     * $oResData['CSTURL'] 결제 영수증 url
     * $oResData['price']  결제 금액
     * $oResData['mul_no'] 결제요청번호
     * TODO : 이곳에서 받은 정보로 DB처리를 한다.
     * ex INSERT BILLPAY ( no , csturl, price, mul_no) value ( '{$no}' ,$oResData['CSTURL'] ,$oResData['price'] ,$oResData['mul_no'] );
     */
    /*
     * 페이지 이동
    * echo <<<EOT
       <script type="text/javascript">
       location.href = '{$oResData['payurl']}';
       </script>
       EOT;
    */

} else {
    /*
     * 결제 실패
     * $oResData['errorMessage'];	// 오류메시지
     * $oResData['errno'];			// 오류코드
     * TODO : 이곳에서 결제요청 실패 정보를 저장하거나, 이전 페이지로 이동해서 다시 시도할 수 있도록 해야 합니다.
     * ex) UPDATE BILL SET errorMessage='{$oResData['errorMessage']}' WHERE no='{$no}'
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
