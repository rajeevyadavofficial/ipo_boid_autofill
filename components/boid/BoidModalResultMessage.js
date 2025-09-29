// components/main/BoidModalResultMessage.js
import React from 'react';
import { Text } from 'react-native';

export default function BoidModalResultMessage({ results, total }) {
  if (!results || results.length === 0 || total === 0) return null;

  const allotted = results.filter((r) =>
    r.result?.toLowerCase().includes('congrat')
  ).length;

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
        ? `🎉 Congratulations ${allotted}/${total} allotted !`
        : `😔 Sorry ${allotted}/${total} allotted !`}
    </Text>
  );
}
