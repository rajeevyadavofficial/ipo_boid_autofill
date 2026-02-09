// components/main/BoidModalResultMessage.js
import React from 'react';
import { Text } from 'react-native';

export default function BoidModalResultMessage({ results, total }) {
  if (!results || results.length === 0 || total === 0) return null;

  const allotted = results.filter((r) =>
    typeof r?.result === 'string' && r.result.toLowerCase().includes('congrat')
  ).length;

  const totalShares = results.reduce((sum, r) => {
    const match = typeof r?.result === 'string' ? r.result.match(/quantity\s*:\s*(\d+)/i) : null;
    return sum + (match ? parseInt(match[1]) : 0);
  }, 0);

  return (
    <Text
      style={{
        textAlign: 'center',
        fontWeight: 'bold',
        marginBottom: 10,
        color: allotted > 0 ? 'green' : 'red',
      }}
    >
      {allotted > 0
        ? `🎉 Congratulations ${allotted}/${total} allotted! ${totalShares > 0 ? `(Total ${totalShares} shares)` : ''}`
        : `😔 Sorry ${allotted}/${total} allotted!`}
    </Text>
  );
}
