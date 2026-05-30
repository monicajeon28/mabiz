package com.udid.payapp_android_sample_v3.dialog;

import android.app.Dialog;
import android.content.Context;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.ListView;

import androidx.annotation.NonNull;

import com.udid.oapi.data.embed.PABillData;
import com.udid.payapp_android_sample_v3.R;

import java.util.List;

public class BillListDialog extends Dialog {

    Context context;

    ListView billListView;

    List<PABillData> billList;

    Button billCloseDialog;

    public BillListDialog(@NonNull Context context, List<PABillData> billList) {
        super(context);
        this.context = context;
        this.billList = billList;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.dialog_bill_list);

        getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));

        billListView = findViewById(R.id.billListView);
        BillListAdapter adapter = new BillListAdapter(context, billList);
        adapter.setOnDeleteListener(new BillListAdapter.OnDeleteListener() {
            @Override
            public void onDelete(int position) {
                billList.remove(position);
                adapter.notifyDataSetChanged();
            }
        });
        billListView.setAdapter(adapter);

        billCloseDialog = findViewById(R.id.billCloseDialog);
        billCloseDialog.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                dismiss();
            }
        });
    }

}
