<%--
  Created by IntelliJ IDEA.
  User: kimjinwon
  Date: 2016. 11. 14.
  Time: 오후 1:06
  To change this template use File | Settings | File Templates.
--%>

<%@ page contentType="text/html;charset=UTF-8" language="java" %>

<jsp:include page="/WEB-INF/view/common/header.jsp"/>

<html>
<head>
    <title>부계정 등록 </title>

    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">

</head>
<body>

<div class="container">

    <div class="page-header">
        <h1>Payapp 부계정 등록 샘플
            <small>for java</small>
        </h1>

    </div>

    <form class="form-horizontal" role="form" method='post' action="subidRegistAction">

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
            <label for="subuserid" class="col-sm-2 control-label">부계정 아이디</label>

            <div class="col-sm-10">
                <input type="text" class="form-control" id="subuserid" name="subuserid" placeholder="부계정 아이디"
                       required="required">
            </div>
        </div>

        <div class="form-group">
            <label for="subpwd" class="col-sm-2 control-label">부계정 비밀번호</label>

            <div class="col-sm-10">
                <input type="text" class="form-control" id="subpwd" name="subpwd" placeholder="부계정 비밀번호"
                       required="required">
            </div>
        </div>

        <div class="form-group">
            <label for="subname" class="col-sm-2 control-label">부계정명</label>

            <div class="col-sm-10">
                <input type="text" class="form-control" id="subname" name="subname" placeholder="부계정명"
                       required="required">
            </div>
        </div>

        <div class="col-sm-offset-2 col-sm-10">
            <button type="submit" class="btn btn-primary">부계정 등록</button>
        </div>
</div>
</form>
</div>
</body>
</html>