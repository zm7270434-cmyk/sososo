// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Yusup Supriyadi
import React from 'react';
import ReactDOM from 'react-dom/client';
import AppRouter from './AppRouter';
import './styles/app.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>,
);
