<%--
  Created by IntelliJ IDEA.
  User: kimjinwon
  Date: 2016. 11. 10.
  Time: 오후 5:43
  To change this template use File | Settings | File Templates.
--%>

<%@ page contentType="text/html;charset=UTF-8" language="java" %>

<jsp:include page="/WEB-INF/view/common/header.jsp"/>

<html>
<head>
  <title>결제 요청 취소 </title>

  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1">

</head>
<body>

<div class="container">

  <div class="page-header">
    <h1>Payapp 결제(요청, 승인)취소 샘플
      <small>for java</small>
    </h1>

  </div>

  <form class="form-horizontal" role="form" method='post' action="paymentReqCancelAction">

    <c:choose>
      <div class="form-group">
        <c:when test="${not empty errorMsg}">
          <label class="error">${errorMsg}</label>
        </c:when>
        <c:when test="${not empty result}">
          <label class="error">${result}</label>
        </c:when>
      </div>
    </c:choose>

    <div class="form-group">
      <label for="userid" class="col-sm-2 control-label">판매자 아이디</label>

      <div class="col-sm-10">
        <input type="text" class="form-control" id="userid" name="userid" placeholder="판매자 아이디"
               required="required">
      </div>
    </div>

    <hr>
    <div class="form-group">
      <label for="linkkey" class="col-sm-2 control-label">연동 KEY</label>

      <div class="col-sm-10">
        <input type="text" class="form-control" id="linkkey" name="linkkey" placeholder="연동 KEY"
               required="required">
      </div>
    </div>
    <div class="form-group">
      <label for="mul_no" class="col-sm-2 control-label">결제요청번호</label>

      <div class="col-sm-10">
        <input type="number" class="form-control" id="mul_no" name="mul_no" placeholder="결제요청번호"
               required="required">
      </div>
    </div>

    <div class="form-group">
      <label for="cancelmode" class="col-sm-2 control-label">결제요청취소 모드</label>

      <div class="col-sm-10">
        <td class="none"><input type="checkbox" id="cancelmode" cancelmode="mode" class="boardcehckbox" value='N'><span class="input-span3"> (체크 = "ready", 값이 ready 인 경우 결제요청 상태만 취소 가능) </span></a>
        </td>
      </div>
    </div>


    <div class="form-group">
      <label for="cancelmemo" class="col-sm-2 control-label">메모</label>

      <div class="col-sm-10">
        <textarea class="form-control" name="cancelmemo" id="cancelmemo" rows="3" placeholder="메모"></textarea>
      </div>
    </div>
    <div class="form-group">
      <div class="col-sm-offset-2 col-sm-10">
        <button type="submit" class="btn btn-primary">결제 요청 취소</button>
      </div>
    </div>
  </form>
</div>
</body>
</html>