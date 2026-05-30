package kr.co.udid.payapp.sample.module.data;

/**
 * Created by kimjinwon on 2016. 11. 14..
 */
public class PayappSubidRegistData {


    /**
     * 부계정 아이디 (필수)
     */
    private String subuserid;

    /**
     * 부계정 비밀번호 (필수)
     */
    private String subpwd;


    /**
     * 부계정명 (필수)
     */
    private String subname;

    /**
     * 대분류
     */
    private String subetc1;

    /**
     * 중분류
     */
    private String subetc2;

    /**
     * 소분류
     */
    private String subetc3;

    /**
     * 직급
     */
    private String subjtype;

    /**
     * 권한
     */
    private String state;

    public PayappSubidRegistData(String subuserid, String subpwd, String subname) {
        this.subuserid = subuserid;
        this.subpwd = subpwd;
        this.subname = subname;
    }


    public String getSubuserid() {
        return subuserid;
    }

    public String getSubpwd() {
        return subpwd;
    }

    public String getSubname() {
        return subname;
    }


    public String getSubetc1() {
        return subetc1;
    }

    public String getSubetc2() {
        return subetc2;
    }

    public String getSubetc3() {
        return subetc3;
    }

    public String getSubjtype() {
        return subjtype;
    }

    public String getState() {
        return state;
    }


    public void setSubetc1(String subetc1) {
        this.subetc1 = subetc1;
    }

    public void setSubetc2(String subetc2) {
        this.subetc2 = subetc2;
    }

    public void setSubetc3(String subetc3) {
        this.subetc3 = subetc3;
    }

    public void setSubjtype(String subjtype) {
        this.subjtype = subjtype;
    }

    public void setState(String state) {
        this.state = state;
    }

    @Override
    public String toString() {
        return "PayappSubidRegistData{" +
                "subuserid='" + subuserid + '\'' +
                ", subpwd='" + subpwd + '\'' +
                ", subname='" + subname + '\'' +
                '}';
    }
}
