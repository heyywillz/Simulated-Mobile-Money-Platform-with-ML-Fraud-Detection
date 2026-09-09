import React from 'react'
import TransactionFlow from '../components/TransactionFlow'
import * as api from '@momo/shared/src/api/endpoints'
import { useAuth } from '../contexts/AuthContext'
import { captureLocation } from '@momo/shared/src/utils/location'

export default function BuyGoods() {
  const { deviceProfile } = useAuth()

  return (
    <TransactionFlow
      type="buy_goods"
      title="Buy Goods / Merchant Pay"
      subtitle="Pay at a registered Merchant Till or Merchant phone number"
      fields={[
        { id: 'receiver', label: 'Merchant or till number', placeholder: 'Enter merchant code' },
        { id: 'receiverName', label: 'Merchant name (optional)', placeholder: 'e.g. ShopRite Accra' },
      ]}
      onSubmit={async (data, amount, authLayers = ['password'], password) => {
        const location = await captureLocation()
        return api.buyGoods({
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
