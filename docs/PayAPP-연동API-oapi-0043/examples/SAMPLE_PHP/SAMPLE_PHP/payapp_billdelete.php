<?php
//-------------------- 등록결제 삭제 --------------------//

/*************************************************************************/
/* payapp                                                                */
/* copyright ⓒ 2019 UDID. all rights reserved.                           */
/*                                                                       */
/* oapi sample                                                           */
/* - payapp 서버로 등록결제 삭제를 전달합니다.                           */
/*                                                                       */
/*************************************************************************/

include("payapp_lib.php");
/*
TODO : 이곳에서 등록결제 삭제를 실행합니다.
*/

// 등록결제 등록
// 업체에 맞게 수정하세요.
$postdata = array(
    'cmd'     => 'billDelete',  // 등록결제  필수
    'userid'  => '판매자 아이디', // 판매자 아이디  필수
    'encBill' => '등록결제 key', // 등록결제 key 필수
);

$oResData = payapp_oapi_post($postdata);
if ($oResData['state']=='1') {
    /*
     * 등록결제 삭제 성공
     * TODO : 이곳에서 받은 정보로 DB처리를 한다.
     * ex DELETE FROM BILL WHERE no =  '{$no}';
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
     * 등록결제 삭제 실패
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
