window.APP_CONFIG = {
  authenticatorURL: 'http://localhost:8081',
  gatewayURL: 'http://localhost:8080',
  endpoints: {
    login: '/api/v1/auth/login',
    register: '/api/v1/auth/createAccount',
    textQuerySubmit: '/api/v1/main/submit/text',
    imageQuerySubmit: '/api/v1/main/submit/image',
    textQueryDetail: '/api/v1/main/query/single/text',
    imageQueryDetail: '/api/v1/main/query/single/image',
    textSummary: '/api/v1/main/query/overview/text',
    imageSummary: '/api/v1/main/query/overview/images'
  }
};
