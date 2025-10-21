import React from 'react';
// import Wrapper from '@/app/components/Wrapper';
// import EmptyState from '@/app/components/EmptyState';

const OfflinePage = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      textAlign: 'center',
      backgroundColor: '#f8f8f8',
      color: '#333',
      padding: '20px'
    }}>
      <h1 style={{ fontSize: '2em', marginBottom: '20px' }}>Vous êtes hors ligne</h1>
      <p style={{ fontSize: '1.1em', marginBottom: '30px' }}>
        Veuillez vous connecter à Internet pour accéder à cette page ou pour travailler sur les projets disponibles hors ligne.
      </p>
      {/* <img src="/empty-project.png" alt="Vous êtes hors ligne" style={{ maxWidth: '200px', marginBottom: '20px' }} /> */}
      {/* Une image locale simple ou une icône SVG intégrée pourrait être utilisée ici si nécessaire */}
    </div>
  );
};

export default OfflinePage;
