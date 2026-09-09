import React from 'react'
import TransactionFlow from '../components/TransactionFlow'
import * as api from '@momo/shared/src/api/endpoints'
import { useAuth } from '../contexts/AuthContext'
import { captureLocation } from '@momo/shared/src/utils/location'

export default function PayBill() {
  const { deviceProfile } = useAuth()

  return (
    <TransactionFlow
      type="pay_bill"
      title="Pay Bills & Utilities"
      subtitle="ECG Prepaid/Postpaid, Ghana Water, DSTV, GOTV & School Fees"
      fields={[
        { id: 'receiver', label: 'Merchant or utility code', placeholder: 'e.g. ECG-PREPAID' },
        { id: 'receiverName', label: 'Account number', placeholder: 'Your account or meter number' },
      ]}
      onSubmit={async (data, amount, authLayers = ['password'], password) => {
        const location = await captureLocation()
        return api.payBill({
          amount,
          receiver: data.receiver,
          receiverName: data.receiverName,
          pin: password,
          password,
          deviceProfile,
          location,
          authLayersPassed: authLayers,
        })
      }}
    />
  )
}
