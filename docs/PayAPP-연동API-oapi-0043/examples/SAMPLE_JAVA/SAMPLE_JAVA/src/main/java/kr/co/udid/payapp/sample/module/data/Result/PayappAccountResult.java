package kr.co.udid.payapp.sample.module.data.Result;

/**
 * 패이앱 결제요청 결과 
 * @author RED
 *
 */
public class PayappAccountResult
{
	/**
	 * 성공 실패 여부
	 */
	boolean success;
	
	/**
	 * 실패시 오류 메시지
	 */
	String errorMessage;
	
	/**
	 * 결제창 URL
	 */
	String payUrl;
	
	/**
	 * 성공시 결제요청 번호
	 */
	String mulNo;

	/**
	 * 성공시 정기 결제 요청 번호
	 */
	private String rebillNo;
	
	/**
	 * 에러 번호
	 */
	String errNo;

	public PayappAccountResult (boolean success, String errorMessage, String payUrl, String mulNo, String errNo)
	{
		super ();
		this.success = success;
		this.errorMessage = errorMessage;
		this.payUrl = payUrl;
		this.mulNo = mulNo;
		this.errNo = errNo;
	}

	public PayappAccountResult(boolean success, String errorMessage, String y, String payUrl, String rebillNo, String errNo) {
		this.success = success;
		this.errorMessage = errorMessage;
		this.payUrl = payUrl;
		this.rebillNo = rebillNo;
		this.errNo = errNo;
	}

    public boolean isSuccess ()
	{
		return success;
	}

	public String getErrorMessage ()
	{
		return errorMessage;
	}

	public String getPayUrl ()
	{
		return payUrl;
	}

	public String getMulNo ()
	{
		return mulNo;
	}

	public String getErrNo ()
	{
		return errNo;
	}

	@Override
	public String toString() {
		return "PayappAccountResult{" +
				"success=" + success +
				", errorMessage='" + errorMessage + '\'' +
				", payUrl='" + payUrl + '\'' +
				", mulNo='" + mulNo + '\'' +
				", rebillNo='" + rebillNo + '\'' +
				", errNo='" + errNo + '\'' +
				'}';
	}
}
