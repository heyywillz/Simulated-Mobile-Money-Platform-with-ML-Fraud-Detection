import React from 'react';
import TransactionFlow from '../components/TransactionFlow';
import * as api from '@momo/shared/src/api/endpoints';
import { useAuth } from '../contexts/AuthContext';
import { captureLocation } from '@momo/shared/src/utils/location';

export default function SendMoney() {
  const { deviceProfile } = useAuth();

  return (
    <TransactionFlow
      type="send"
      title="Send Money"
      subtitle="Instant P2P transfer to any Mobile Money user"
      fields={[
        {
          id: 'receiver',
          label: 'Recipient phone number',
          placeholder: '024 123 4567',
          prefix: '+233',
        },
        {
          id: 'receiverName',
          label: 'Recipient name (optional)',
          placeholder: 'e.g. Ama Tetteh',
        },
      ]}
      onSubmit={async (data, amount, authLayers = ['password'], password) => {
        const location = await captureLocation();
        return api.sendMoney({
          amount,
          receiver: data.receiver,
          receiverName: data.receiverName,
          pin: password,
          password,
          deviceProfile,
          location,
          authLayersPassed: authLayers,
        });
      }}
    />
  );
}
