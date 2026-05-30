<?php
//-------------------- 등록결제 등록 --------------------//

/*************************************************************************/
/* payapp                                                                */
/* copyright ⓒ 2019 UDID. all rights reserved.                           */
/*                                                                       */
/* oapi sample                                                           */
/* - payapp 서버로 등록결제 등록합니다.                                      */
/*                                                                       */
/*************************************************************************/

include("payapp_lib.php");
/*
TODO : 이곳에서 등록결제 등록을 실행합니다.
*/

// 등록결제 등록
// 업체에 맞게 수정하세요.
$postdata = array(
    'cmd'         => 'billRegist',         // 등록결제 등록, 필수
    'userid'      => '판매자아이디',         // 판매자 아이디, 필수
    'cardNo'      => '카드번호',            // 구매자카드번호
    'expMonth'    => '카드유효기간(월)',     // 카드유효기간(월) MM 필수
    'expYear'     => '카드유효기간(년)',     // 카드유효기간(년)YY 필수
    'buyerAuthNo' => '생년월일',            // 구매자확인 개인 :생년월일(6자리), 사업자번호 필수
    'cardPw'      => '카드비밀번호 앞 두자리', // 카드비밀번호 앞 두자리 필수
    'buyerPhone'  => '구매자 전화번호',       // 구매자 전화번호 필수
    'buyerName'   => '구매자 성명',          // 구매자 성명 필수
    'buyerId'     => '',                    // 구매자 아이디
);

$oResData = payapp_oapi_post($postdata);
if ($oResData['state']=='1') {
    /*
     * 등록결제 성공
     * $oResData['encBill'] 결제회원번호
     * $oResData['cardNo'] 카드번호
     * $oResData['cardname'] 카드이름
     * TODO : 이곳에서 받은 정보로 DB처리를 한다.
     * ex INSERT BILL ( no , encBill) value ( '{$no}' ,$oResData['encBill'] );
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
    * 등록결제 실패
    * $oResData['errorMessage'];    // 오류메시지
    * $oResData['errno'];            // 오류코드
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
