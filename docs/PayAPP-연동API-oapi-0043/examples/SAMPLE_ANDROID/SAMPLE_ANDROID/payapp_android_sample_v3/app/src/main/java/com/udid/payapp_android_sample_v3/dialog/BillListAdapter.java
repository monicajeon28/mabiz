package com.udid.payapp_android_sample_v3.dialog;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.udid.oapi.PayAppOAPI;
import com.udid.oapi.data.embed.PABillData;
import com.udid.oapi.data.PABillDeleteData;
import com.udid.oapi.data.PABillDeleteResponseData;
import com.udid.oapi.data.PABillPaymentData;
import com.udid.oapi.data.PABillPaymentResponseData;
import com.udid.oapi.sv.handler.PAResultHandler;
import com.udid.payapp_android_sample_v3.R;

import java.util.List;

public class BillListAdapter extends ArrayAdapter<PABillData> {

    Context context;

    List<PABillData> billList;

    public BillListAdapter(Context context, List<PABillData> billList) {
        super(context, 0, billList);
        this.context = context;
        this.billList = billList;
    }

    public interface OnDeleteListener {
        void onDelete(int position);
    }
    private OnDeleteListener onDeleteListener;
    public void setOnDeleteListener(OnDeleteListener onDeleteListener) {
        this.onDeleteListener = onDeleteListener;
    }

    @NonNull
    @Override
    public View getView(int position, @Nullable View convertView, @NonNull ViewGroup parent) {
        PABillData bilLData = billList.get(position);

        if (convertView == null) {
            convertView = LayoutInflater.from(getContext()).inflate(R.layout.item_bill_list, parent, false);
        }

        TextView buyerNameTv = convertView.findViewById(R.id.buyerNameTv);
        TextView cardNoTv = convertView.findViewById(R.id.cardNoTv);
        Button billDeleteDialog = convertView.findViewById(R.id.billDeleteDialog);
        Button billPaymentDialog = convertView.findViewById(R.id.billPaymentDialog);

        buyerNameTv.setText(bilLData.getBuyerName());
        cardNoTv.setText(bilLData.getBillResoponseData().getCardno());

        billDeleteDialog.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                PABillDeleteData data = PABillDeleteData.builder(bilLData.getUserId(), bilLData.getBillResoponseData().getEncBill()).build();
                PayAppOAPI.create().billDelete(data, new PAResultHandler<PABillDeleteResponseData>() {
                    @Override
                    public void response(PABillDeleteResponseData result) {
                        if (result.getState().equals("1")) {
                            Toast.makeText(context, "등록결제(BILL) 삭제 성공", Toast.LENGTH_SHORT).show();
                            onDeleteListener.onDelete(position);
                        } else {
                            Toast.makeText(context, result.getErrorMessage(), Toast.LENGTH_SHORT).show();
                        }
                    }
                });
            }
        });

        billPaymentDialog.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                PABillPaymentData data = PABillPaymentData.builder(bilLData.getUserId(), bilLData.getBillResoponseData().getEncBill(),"BILL 테스트 상품","1000",bilLData.getRecvPhone()).build();
                PayAppOAPI.create().billPayment(data, new PAResultHandler<PABillPaymentResponseData>() {
                    @Override
                    public void response(PABillPaymentResponseData result) {
                        if (result.getState().equals("1")) {
                            Toast.makeText(context, "등록결제(BILL) 결제 성공", Toast.LENGTH_SHORT).show();
                        } else {
                            Toast.makeText(context, result.getErrorMessage(), Toast.LENGTH_SHORT).show();
                        }
                    }
                });
            }
        });

        return convertView;
    }
}