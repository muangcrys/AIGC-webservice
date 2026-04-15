import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';

const AUTH_CARD_CLASS = 'w-full max-w-[520px] rounded-[28px] border border-white/25 bg-white/15 p-6 sm:p-10 shadow-[0_24px_80px_rgba(15,23,42,0.35)] backdrop-blur-xl';
const AUTH_FIELD_CLASS = 'w-full rounded-2xl border border-transparent bg-white/95 px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-900/45 focus:-translate-y-0.5 focus:border-amber-400 focus:shadow-[0_0_0_4px_rgba(245,158,11,0.18)]';
const AUTH_SECONDARY_BTN_BASE = 'rounded-2xl border border-white/25 px-4 py-3.5 font-bold text-slate-50 transition hover:-translate-y-0.5';
const AUTH_PRIMARY_BTN_BASE = 'rounded-2xl bg-gradient-to-r px-4 py-3.5 font-bold text-slate-900 transition hover:-translate-y-0.5';

const DASHBOARD_PANEL_CLASS = 'rounded-[28px] border border-white/25 bg-white/15 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.35)] backdrop-blur-xl md:p-10';
const SIDEBAR_SECTION_CLASS = 'flex min-h-0 flex-1 flex-col py-3';
const SIDEBAR_SECTION_TITLE_CLASS = 'px-5 py-2 text-xs font-bold uppercase tracking-[0.05em] text-amber-400';
const SIDEBAR_EMPTY_CLASS = 'px-5 py-3 text-center text-sm text-slate-200/80';
const SIDEBAR_LIST_CLASS = 'm-0 min-h-0 list-none overflow-y-auto p-0';
const SIDEBAR_LINK_BASE_CLASS = 'block px-5 py-3 text-[0.95rem] font-medium transition';
const MAX_IMAGE_UPLOAD_BYTES = 350 * 1024;

const defaultConfig = {
  authenticatorURL: '',
  endpoints: {
    login: '/api/login',
    register: '/api/register'
  }
};

function getConfig() {
  return window.APP_CONFIG ?? defaultConfig;
}

function joinUrl(baseUrl, path) {
  if (!baseUrl) {
    return path;
  }

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function getQueryLinkClass(isActive) {
  return cx(
    SIDEBAR_LINK_BASE_CLASS,
    'w-full border-0 bg-transparent text-left transition-all duration-150',
    isActive
      ? 'border-l-[3px] border-emerald-400 bg-emerald-400/12 pl-[17px] text-slate-50 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.28)]'
      : 'text-slate-200/80 hover:-translate-y-0.5 hover:bg-white/12 hover:text-slate-50 hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
  );
}

function isActiveQuery(queryType, query, activeQuery, activeQueryType) {
  return activeQueryType === queryType && activeQuery?.queryID === query?.queryID;
}

function mergeOverviewWithDetail(overviewItems, detail) {
  if (!detail?.queryID) {
    return overviewItems;
  }

  return overviewItems.map((item) => {
    if (item?.queryID !== detail.queryID) {
      return item;
    }

    return {
      ...item,
      finished: detail.finished,
      artificialProbability: detail.artificialProbability,
      timestamp: detail.timestamp ?? item.timestamp,
      queryName: detail.queryName ?? item.queryName,
      reason: detail.reason ?? item.reason,
    };
  });
}

function getQueryTypeButtonClass(isActive) {
  return cx(
    'rounded-xl border-2 px-4 py-3 text-sm font-semibold transition',
    isActive
      ? 'border-amber-500 bg-amber-500/15 text-amber-400'
      : 'border-white/20 bg-white/8 text-slate-200/80 hover:border-white/40 hover:bg-white/12'
  );
}

function getQueryOverviewTitle(query, index) {
  return query?.queryName || query?.queryID || `Query ${index + 1}`;
}

function getQueryOverviewStatus(query) {
  if (query?.finished) {
    return {
      type: 'dot',
      colorClass: 'bg-emerald-400'
    };
  }

  return {
    type: 'dot',
    colorClass: 'bg-amber-400'
  };
}

function formatArtificialProbabilityPercent(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return String(value);
  }

  const percent = numericValue * 100;
  return `${percent.toFixed(2)}%`;
}

function getArtificialProbabilityInterpretation(value) {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return '';
  }

  const percent = numericValue * 100;

  if (percent >= 0 && percent <= 15) {
    return 'Most likely not AI-generated';
  }

  if (percent > 15 && percent <= 45) {
    return 'Probably not AI-generated';
  }

  if (percent >= 55 && percent <= 65) {
    return 'Borderline';
  }

  if (percent > 65 && percent <= 85) {
    return 'Probably AI-generated';
  }

  if (percent > 85 && percent <= 100) {
    return 'Most likely AI-generated';
  }

  return 'Uncertain';
}

function getArtificialProbabilityToneClass(value) {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return 'border-white/15 bg-white/6 text-slate-50';
  }

  const percent = numericValue * 100;

  if (percent <= 15) {
    return 'border-emerald-300/35 bg-emerald-400/10 text-emerald-100';
  }

  if (percent <= 45) {
    return 'border-lime-300/35 bg-lime-400/10 text-lime-100';
  }

  if (percent < 65) {
    return 'border-amber-300/40 bg-amber-400/12 text-amber-100';
  }

  if (percent <= 85) {
    return 'border-orange-300/45 bg-orange-400/14 text-orange-100';
  }

  return 'border-rose-300/45 bg-rose-400/14 text-rose-100';
}

function parseIsoTimestampToEpoch(timestamp) {
  if (!timestamp || typeof timestamp !== 'string') {
    return Number.NEGATIVE_INFINITY;
  }

  // Keep nanosecond precision strings compatible with Date by trimming to milliseconds.
  const normalized = timestamp.replace(/\.(\d{3})\d+Z$/, '.$1Z');
  const epoch = Date.parse(normalized);
  return Number.isNaN(epoch) ? Number.NEGATIVE_INFINITY : epoch;
}

function formatRelativeTimestamp(timestamp) {
  const epoch = parseIsoTimestampToEpoch(timestamp);
  if (!Number.isFinite(epoch)) {
    return '';
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - epoch) / 1000));
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  const elapsedDays = Math.floor(elapsedHours / 24);

  if (elapsedSeconds < 60) {
    return elapsedSeconds <= 1 ? 'just now' : `${elapsedSeconds} seconds ago`;
  }

  if (elapsedMinutes < 60) {
    return elapsedMinutes === 1 ? '1 minute ago' : `${elapsedMinutes} minutes ago`;
  }

  if (elapsedHours < 24) {
    return elapsedHours === 1 ? '1 hour ago' : `${elapsedHours} hours ago`;
  }

  if (elapsedDays < 7) {
    return elapsedDays === 1 ? '1 day ago' : `${elapsedDays} days ago`;
  }

  const weeks = Math.floor(elapsedDays / 7);
  if (weeks < 5) {
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }

  const months = Math.floor(elapsedDays / 30);
  if (months < 12) {
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }

  const years = Math.floor(elapsedDays / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

function sortQueriesByNewestFirst(items) {
  return [...items].sort((left, right) => {
    return parseIsoTimestampToEpoch(right?.timestamp) - parseIsoTimestampToEpoch(left?.timestamp);
  });
}

function buildImageSrc(imageBase64) {
  if (!imageBase64) {
    return '';
  }

  if (imageBase64.startsWith('data:')) {
    return imageBase64;
  }

  return `data:image/png;base64,${imageBase64}`;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result ?? '');
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error('Unable to read file.'));
    };

    reader.readAsDataURL(file);
  });
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function LoginPage() {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [authNoticeBanner, setAuthNoticeBanner] = useState('');
  const [formValues, setFormValues] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });

  const appConfig = useMemo(() => getConfig(), []);
  const navigate = useNavigate();

  useEffect(() => {
    const authNotice = localStorage.getItem('auth.notice');
    if (authNotice) {
      setAuthNoticeBanner(authNotice);
      localStorage.removeItem('auth.notice');
    }
  }, []);

  useEffect(() => {
    document.title = 'AIGC Detector Login';
  }, []);

  async function performLogin(username, password) {
    const payload = {
      username,
      password
    };

    const loginUrl = joinUrl(appConfig.authenticatorURL ?? '', appConfig.endpoints.login);

    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setLoginError(result.reason ?? 'Login failed. Please try again.');
        return false;
      }

      localStorage.setItem('auth.token', result.token ?? '');
      localStorage.setItem('auth.username', result.username ?? '');
      localStorage.setItem('auth.expiry', result.expiry ?? '');

      setLoginError('');
      navigate('/dashboard', { replace: true });
      console.log('Login successful:', {
        username: result.username,
        token: result.token,
        expiry: result.expiry
      });
      return true;
    } catch (error) {
      setLoginError('Unable to reach login service. Please try again.');
      console.error('Login request failed:', error);
      return false;
    }
  }

  function handleInputChange(event) {
    const { name, value } = event.target;
    setFormValues((previousValues) => ({
      ...previousValues,
      [name]: value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isRegisterMode) {
      const hasValidUsername = formValues.username.trim().length > 6;
      const hasValidPassword = formValues.password.length > 6;
      const hasMatchingPasswords = formValues.password === formValues.confirmPassword;

      if (!hasValidUsername || !hasValidPassword) {
        setLoginError('Username and password must each be more than 6 characters.');
        return;
      }

      if (!hasMatchingPasswords) {
        setLoginError('Passwords do not match.');
        return;
      }

      setLoginError('');
      const payload = {
        username: formValues.username,
        password: formValues.password,
        confirmPassword: formValues.confirmPassword
      };

      const registerUrl = joinUrl(appConfig.authenticatorURL ?? '', appConfig.endpoints.register);

      try {
        const response = await fetch(registerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          setLoginError(result.reason ?? 'Registration failed. Please try again.');
          return;
        }

        setLoginError('');
        setFormValues({
          username: '',
          password: '',
          confirmPassword: ''
        });
        console.log('Registration successful:', {
          username: result.username
        });

        await performLogin(formValues.username, formValues.password);
      } catch (error) {
        setLoginError('Unable to reach registration service. Please try again.');
        console.error('Registration request failed:', error);
      }
      return;
    }

    await performLogin(formValues.username, formValues.password);
  }

  const title = isRegisterMode ? 'Create your account' : 'Welcome back';
  const subtitle = isRegisterMode
    ? 'Set up a new account to get started with the platform.'
    : 'Sign in to access your workspace and continue where you left off.';
  const helperText = isRegisterMode
    ? 'Fill in your details to create a new account.'
    : 'Use your existing credentials to log in.';

  const secondaryBtnClass = isRegisterMode
    ? `${AUTH_SECONDARY_BTN_BASE} bg-white/20 hover:bg-white/25`
    : `${AUTH_SECONDARY_BTN_BASE} bg-white/12 hover:bg-white/18`;

  const primaryBtnClass = isRegisterMode
    ? `${AUTH_PRIMARY_BTN_BASE} from-blue-300 to-blue-500 shadow-[0_12px_28px_rgba(96,165,250,0.22)] hover:from-blue-400 hover:to-blue-600`
    : `${AUTH_PRIMARY_BTN_BASE} from-amber-200 to-amber-500 shadow-[0_12px_28px_rgba(245,158,11,0.22)] hover:from-amber-300 hover:to-amber-600`;

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.28),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.28),transparent_28%),linear-gradient(135deg,#0f172a,#1d4ed8)] p-6 text-slate-50">
      <section className={AUTH_CARD_CLASS} aria-labelledby="page-title">
        <div className="mb-6">
          <span className="mb-2.5 inline-flex items-center rounded-full bg-white/12 px-3 py-1.5 text-xs uppercase tracking-[0.08em] text-slate-200">
            AIGC Detector Project
          </span>
          <h1 id="page-title" className="m-0 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-2.5 leading-relaxed text-slate-200/80">{subtitle}</p>
        </div>

        {authNoticeBanner && (
          <div className="mb-4 rounded-xl border border-red-300/45 bg-red-500/18 px-4 py-3 text-sm font-semibold text-red-100">
            {authNoticeBanner}
          </div>
        )}

        <form className="grid gap-3.5" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-[0.95rem] font-semibold">
            <span className="text-slate-100/90">Username</span>
            <input
              type="text"
              name="username"
              placeholder="Enter your username"
              autoComplete="username"
              value={formValues.username}
              onChange={handleInputChange}
              className={AUTH_FIELD_CLASS}
            />
          </label>

          <label className="grid gap-2 text-[0.95rem] font-semibold">
            <span className="text-slate-100/90">Password</span>
            <input
              type="password"
              name="password"
              placeholder="Enter your password"
              autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
              value={formValues.password}
              onChange={handleInputChange}
              className={AUTH_FIELD_CLASS}
            />
          </label>

          {isRegisterMode && (
            <label className="grid gap-2 text-[0.95rem] font-semibold">
              <span className="text-slate-100/90">Confirm password</span>
              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirm your password"
                autoComplete="new-password"
                value={formValues.confirmPassword}
                onChange={handleInputChange}
                className={AUTH_FIELD_CLASS}
              />
            </label>
          )}

          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              className={secondaryBtnClass}
              onClick={() => {
                setLoginError('');
                setAuthNoticeBanner('');
                setFormValues({
                  username: '',
                  password: '',
                  confirmPassword: ''
                });
                setIsRegisterMode((value) => !value);
              }}
            >
              {isRegisterMode ? 'Back to login' : 'Create account'}
            </button>
            <button type="submit" className={primaryBtnClass}>
              {isRegisterMode ? 'Create account' : 'Login'}
            </button>
          </div>
        </form>

        <p className="mt-4 leading-relaxed text-slate-200/80">{helperText}</p>
        {loginError && <p className="mt-2.5 font-semibold leading-relaxed text-red-200">{loginError}</p>}
      </section>
    </main>
  );
}

function DashboardPage() {
  const username = localStorage.getItem('auth.username') ?? 'User';
  const navigate = useNavigate();
  const appConfig = useMemo(() => window.APP_CONFIG ?? {}, []);
  const [textQueries, setTextQueries] = useState([]);
  const [imageQueries, setImageQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isNewQueryMode, setIsNewQueryMode] = useState(false);
  const [newQueryType, setNewQueryType] = useState('image');
  const [newQueryName, setNewQueryName] = useState('');
  const [newQueryText, setNewQueryText] = useState('');
  const [newQueryImage, setNewQueryImage] = useState(null);
  const [newQueryImagePreviewUrl, setNewQueryImagePreviewUrl] = useState('');
  const [newQueryError, setNewQueryError] = useState('');
  const [dashboardNotice, setDashboardNotice] = useState('');
  const [activeQuery, setActiveQuery] = useState(null);
  const [activeQueryType, setActiveQueryType] = useState('text');
  const [activeQueryLoading, setActiveQueryLoading] = useState(false);
  const [activeQueryError, setActiveQueryError] = useState('');
  const imageInputRef = useRef(null);

  useEffect(() => {
    document.title = 'AIGC Detector Dashboard';
  }, []);

  useEffect(() => {
    if (!dashboardNotice) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setDashboardNotice('');
    }, 30000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [dashboardNotice]);

  function handleUnauthorized() {
    localStorage.setItem('auth.notice', 'Session expired or unauthorized. Please log in again to continue.');
    handleLogout();
  }

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const gatewayURL = appConfig.gatewayURL ?? 'http://localhost:8080';

      const textOverviewURL = `${gatewayURL}${appConfig.endpoints?.textSummary ?? ''}`;
      const imageOverviewURL = `${gatewayURL}${appConfig.endpoints?.imageSummary ?? ''}`;

      const requestToken = {
        username: localStorage.getItem('auth.username') ?? '',
        token: localStorage.getItem('auth.token') ?? '',
      };

      const [response1, response2] = await Promise.all([
        fetch(textOverviewURL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestToken)
        }),
        fetch(imageOverviewURL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestToken)
        })
      ]);

      if (response1.status === 401 || response2.status === 401) {
        handleUnauthorized();
        return;
      }

      const result1 = await response1.json();
      const result2 = await response2.json();

      const textData = sortQueriesByNewestFirst(Array.isArray(result1) ? result1 : [result1]);
      const imageData = sortQueriesByNewestFirst(Array.isArray(result2) ? result2 : [result2]);

      setTextQueries(textData);
      setImageQueries(imageData);
      console.log('Dashboard data loaded - Text Queries:', textData, 'Image Queries:', imageData);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [appConfig]);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (!newQueryImage) {
      setNewQueryImagePreviewUrl('');
      return undefined;
    }

    const objectUrl = URL.createObjectURL(newQueryImage);
    setNewQueryImagePreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [newQueryImage]);

  function handleLogout() {
    localStorage.removeItem('auth.token');
    localStorage.removeItem('auth.username');
    localStorage.removeItem('auth.expiry');
    navigate('/', { replace: true });
  }

  async function handleQuerySelect(queryType, query) {
    setDashboardNotice('');
    setNewQueryError('');
    setActiveQueryError('');
    setActiveQueryLoading(true);
    setIsNewQueryMode(false);
    setActiveQueryType(queryType);

    try {
      const gatewayURL = appConfig.gatewayURL ?? 'http://localhost:8080';
      const detailEndpoint = queryType === 'image'
        ? appConfig.endpoints?.imageQueryDetail ?? '/api/v1/main/query/image'
        : appConfig.endpoints?.textQueryDetail ?? '/api/v1/main/query/text';

      const detailUrl = joinUrl(gatewayURL, detailEndpoint);
      const response = await fetch(detailUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: localStorage.getItem('auth.username') ?? '',
          token: localStorage.getItem('auth.token') ?? '',
          queryID: query?.queryID ?? ''
        })
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Unable to load query details.');
      }

      const result = await response.json();
      setActiveQuery(result);

      if (queryType === 'text') {
        setTextQueries((previousQueries) => mergeOverviewWithDetail(previousQueries, result));
      } else {
        setImageQueries((previousQueries) => mergeOverviewWithDetail(previousQueries, result));
      }
    } catch (error) {
      setActiveQuery(null);
      setActiveQueryError(error.message || 'Unable to load query details.');
      console.error('Query detail fetch failed:', error);
    } finally {
      setActiveQueryLoading(false);
    }
  }

  async function handleRefreshSidebar() {
    setDashboardNotice('');
    await fetchDashboardData();
  }

  async function handleNewQuerySubmit(event) {
    event.preventDefault();
    setDashboardNotice('');

    const queryName = newQueryName.trim();

    if (newQueryType === 'image' && !newQueryImage) {
      setNewQueryError('Please upload an image before submitting.');
      return;
    }

    if (newQueryType === 'image' && newQueryImage.size > MAX_IMAGE_UPLOAD_BYTES) {
      setNewQueryError('Image must be 350KB or smaller.');
      return;
    }

    if (newQueryType === 'text' && !newQueryText.trim()) {
      setNewQueryError('Please enter a text query before submitting.');
      return;
    }

    try {
      const gatewayURL = appConfig.gatewayURL ?? 'http://localhost:8080';
      const submitUrl = joinUrl(
        gatewayURL,
        newQueryType === 'image'
          ? appConfig.endpoints?.imageQuerySubmit ?? ''
          : appConfig.endpoints?.textQuerySubmit ?? ''
      );

      const submissionPayload = {
        username: localStorage.getItem('auth.username') ?? '',
        token: localStorage.getItem('auth.token') ?? '',
        jobName: queryName,
        payload: newQueryType === 'image'
          ? await readFileAsBase64(newQueryImage)
          : newQueryText.trim()
      };

      const response = await fetch(submitUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submissionPayload)
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (response.status !== 200) {
        const errorText = await response.text();
        throw new Error(errorText || `${newQueryType === 'image' ? 'Image' : 'Text'} query submission failed.`);
      }

      setNewQueryError('');
      setDashboardNotice('Job submitted successfully.');
      setNewQueryName('');
      setNewQueryText('');
      setNewQueryImage(null);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
      console.log(`${newQueryType === 'image' ? 'Image' : 'Text'} query submitted:`, submissionPayload);

      await fetchDashboardData();
    } catch (error) {
      setNewQueryError(error.message || `Unable to submit ${newQueryType === 'image' ? 'image' : 'text'} query.`);
      console.error(`${newQueryType === 'image' ? 'Image' : 'Text'} query submission failed:`, error);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-slate-50">
      <header className="border-b border-white/20 bg-white/8 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-start justify-between gap-3 md:flex-row md:items-center">
          <h1 className="m-0 text-2xl font-bold">AIGC Detector Project</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-200/80">{username}</span>
            <button
              className="rounded-lg border border-white/20 bg-white/12 px-4 py-2 text-sm font-semibold transition hover:bg-white/18"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col md:flex-row">
        <aside className="flex w-full shrink-0 flex-col gap-3 border-b border-white/20 bg-white/4 p-3 md:w-80 md:border-r md:border-b-0 md:p-4">
          <button
            className="w-full rounded-lg bg-gradient-to-r from-amber-200 to-amber-500 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:from-amber-300 hover:to-amber-600 hover:shadow-[0_4px_12px_rgba(245,158,11,0.2)]"
            onClick={() => {
              setIsNewQueryMode(true);
              setActiveQuery(null);
              setActiveQueryError('');
            }}
          >
            New Query
          </button>
          <button
            className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/16 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              void handleRefreshSidebar();
            }}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <nav className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {loading ? (
              <div className="px-5 py-3 text-center text-sm text-slate-200/80">Loading...</div>
            ) : (
              <>
                <div className="flex min-h-0 flex-1 flex-col border-b border-white/10 py-3">
                  <div className={SIDEBAR_SECTION_TITLE_CLASS}>Text Queries</div>
                  {textQueries.length === 0 ? (
                    <div className={SIDEBAR_EMPTY_CLASS}>No text queries</div>
                  ) : (
                    <ul className={SIDEBAR_LIST_CLASS}>
                      {textQueries.map((item, index) => (
                        <li key={`text-${index}`}>
                          <button
                            type="button"
                            className={getQueryLinkClass(isActiveQuery('text', item, activeQuery, activeQueryType))}
                            onClick={() => {
                              void handleQuerySelect('text', item);
                            }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-slate-50">
                                  {getQueryOverviewTitle(item, index)}
                                </span>
                                <div className="mt-0.5 flex items-center justify-between gap-2 text-[0.7rem] font-medium text-slate-200/70">
                                  <div className="flex min-w-0 items-center gap-2">
                                    {item?.artificialProbability !== null && item?.artificialProbability !== undefined && (
                                      <span className="shrink-0">
                                        {formatArtificialProbabilityPercent(item.artificialProbability)}
                                      </span>
                                    )}
                                    <span className="truncate">
                                      {formatRelativeTimestamp(item?.timestamp)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <span
                                className={`shrink-0 rounded-full ${getQueryOverviewStatus(item).colorClass}`}
                                style={{ width: '0.55rem', height: '0.55rem' }}
                                aria-label={item?.finished ? 'Completed' : 'Pending'}
                              />
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className={SIDEBAR_SECTION_CLASS}>
                  <div className={SIDEBAR_SECTION_TITLE_CLASS}>Image Queries</div>
                  {imageQueries.length === 0 ? (
                    <div className={SIDEBAR_EMPTY_CLASS}>No image queries</div>
                  ) : (
                    <ul className={SIDEBAR_LIST_CLASS}>
                      {imageQueries.map((item, index) => (
                        <li key={`image-${index}`}>
                          <button
                            type="button"
                            className={getQueryLinkClass(isActiveQuery('image', item, activeQuery, activeQueryType))}
                            onClick={() => {
                              void handleQuerySelect('image', item);
                            }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-slate-50">
                                  {getQueryOverviewTitle(item, index)}
                                </span>
                                <div className="mt-0.5 flex items-center justify-between gap-2 text-[0.7rem] font-medium text-slate-200/70">
                                  <div className="flex min-w-0 items-center gap-2">
                                    {item?.artificialProbability !== null && item?.artificialProbability !== undefined && (
                                      <span className="shrink-0">
                                        {formatArtificialProbabilityPercent(item.artificialProbability)}
                                      </span>
                                    )}
                                    <span className="truncate">
                                      {formatRelativeTimestamp(item?.timestamp)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <span
                                className={`shrink-0 rounded-full ${getQueryOverviewStatus(item).colorClass}`}
                                style={{ width: '0.55rem', height: '0.55rem' }}
                                aria-label={item?.finished ? 'Completed' : 'Pending'}
                              />
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {dashboardNotice && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100">
              <span>{dashboardNotice}</span>
              <button
                type="button"
                className="rounded-md border border-emerald-300/40 bg-emerald-400/12 px-2 py-1 text-xs font-bold text-emerald-100 transition hover:bg-emerald-400/20"
                onClick={() => setDashboardNotice('')}
                aria-label="Close notification"
              >
                Close
              </button>
            </div>
          )}
          {isNewQueryMode ? (
            <section className={DASHBOARD_PANEL_CLASS}>
              <div className="mb-8">
                <h2 className="m-0 text-2xl font-bold">Create New Query</h2>
              </div>

              <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className={getQueryTypeButtonClass(newQueryType === 'image')}
                  onClick={() => {
                    setNewQueryType('image');
                    setNewQueryError('');
                      setDashboardNotice('');
                  }}
                >
                  Image Query
                </button>
                <button
                  type="button"
                  className={getQueryTypeButtonClass(newQueryType === 'text')}
                  onClick={() => {
                    setNewQueryType('text');
                    setNewQueryError('');
                    setDashboardNotice('');
                  }}
                >
                  Text Query
                </button>
              </div>

              <form className="flex flex-col gap-6" onSubmit={handleNewQuerySubmit}>
                <div className="flex flex-col gap-2">
                  <label htmlFor="query-name-input" className="text-sm font-semibold text-slate-50">Query Name</label>
                  <input
                    type="text"
                    id="query-name-input"
                    name="queryName"
                    placeholder="Enter query name"
                    value={newQueryName}
                    onChange={(event) => {
                      setNewQueryName(event.target.value);
                      setNewQueryError('');
                      setDashboardNotice('');
                    }}
                    className="rounded-xl border border-white/25 bg-white/92 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-900/55 focus:border-amber-500 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.1)]"
                  />
                </div>

                {newQueryType === 'image' ? (
                  <div className="flex flex-col gap-2">
                    <label htmlFor="image-input" className="text-sm font-semibold text-slate-50">Upload Image</label>
                    <input
                      type="file"
                      id="image-input"
                      name="image"
                      ref={imageInputRef}
                      accept="image/*"
                      required={newQueryType === 'image'}
                      onChange={(event) => {
                        const selectedFile = event.target.files?.[0] ?? null;

                        if (selectedFile && selectedFile.size > MAX_IMAGE_UPLOAD_BYTES) {
                          setNewQueryImage(null);
                          setNewQueryError('Image must be 350KB or smaller.');
                          setDashboardNotice('');
                          event.target.value = '';
                          return;
                        }

                        setNewQueryImage(selectedFile);
                        setNewQueryError('');
                        setDashboardNotice('');
                      }}
                      className="rounded-xl border border-white/25 bg-white/92 px-4 py-3 text-sm text-slate-900 outline-none transition file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-slate-900 focus:border-amber-500 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.1)]"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <label htmlFor="text-input" className="text-sm font-semibold text-slate-50">Enter Text Query</label>
                    <textarea
                      id="text-input"
                      name="text"
                      placeholder="Enter your text query here..."
                      rows="6"
                      required={newQueryType === 'text'}
                      value={newQueryText}
                      onChange={(event) => {
                        setNewQueryText(event.target.value);
                        setNewQueryError('');
                        setDashboardNotice('');
                      }}
                      className="min-h-[120px] resize-y rounded-xl border border-white/25 bg-white/92 px-4 py-3 text-sm leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-900/55 focus:border-amber-500 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.1)]"
                    />
                  </div>
                )}
                {newQueryError && (
                  <p className="text-sm font-semibold text-red-200">{newQueryError}</p>
                )}
                <button
                  type="submit"
                  className="rounded-xl bg-gradient-to-r from-amber-200 to-amber-500 px-6 py-3.5 text-sm font-bold text-slate-900 shadow-[0_12px_28px_rgba(245,158,11,0.22)] transition hover:-translate-y-0.5 hover:from-amber-300 hover:to-amber-600 hover:shadow-[0_16px_32px_rgba(245,158,11,0.28)]"
                >
                  Submit Query
                </button>

                {newQueryType === 'image' && newQueryImagePreviewUrl && (
                  <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/8">
                    <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-slate-100/90">
                      Image Preview
                    </div>
                    <div className="flex justify-center bg-slate-950/20 p-4">
                      <img
                        src={newQueryImagePreviewUrl}
                        alt="Selected upload preview"
                        className="max-h-72 w-full max-w-2xl rounded-xl object-contain"
                      />
                    </div>
                    {newQueryImage?.name && (
                      <div className="px-4 pb-4 text-sm text-slate-200/80">
                        {newQueryImage.name}
                      </div>
                    )}
                  </div>
                )}
              </form>
            </section>
          ) : activeQueryLoading ? (
            <section className="rounded-xl border border-white/25 bg-white/4 p-6 text-slate-50">
              <p className="m-0 text-sm text-slate-200/80">Loading query details...</p>
            </section>
          ) : activeQueryError ? (
            <section className="rounded-xl border border-white/25 bg-white/4 p-6 text-slate-50">
              <p className="m-0 text-sm font-semibold text-red-200">{activeQueryError}</p>
            </section>
          ) : activeQuery ? (
            <section className={DASHBOARD_PANEL_CLASS}>
              <div className="mb-6 flex flex-col gap-2">
                <h2 className="m-0 text-2xl font-bold">{activeQuery.queryName || activeQuery.queryID}</h2>
                <div className="flex flex-wrap gap-3 text-sm text-slate-200/75">
                  {activeQuery.timestamp && (
                    <span className="text-[0.72rem] text-slate-200/65">
                      {formatRelativeTimestamp(activeQuery.timestamp)}
                    </span>
                  )}
                </div>
              </div>

              <div className="mb-6 rounded-2xl border border-white/20 bg-white/8 px-4 py-3">
                <div className="mb-2 text-sm font-semibold text-slate-100/90">Status</div>
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1 shrink-0 rounded-full ${getQueryOverviewStatus(activeQuery).colorClass}`}
                    style={{ width: '0.65rem', height: '0.65rem' }}
                    aria-label={activeQuery.finished ? 'Completed' : 'Pending'}
                  />
                  <p className="m-0 text-sm leading-relaxed text-slate-200/75">
                    {activeQuery.reason || 'No status reason provided.'}
                  </p>
                </div>
              </div>

              {activeQueryType === 'text' ? (
                <div className="rounded-2xl border border-white/20 bg-white/8 p-4">
                  <div className="mb-2 text-sm font-semibold text-slate-100/90">Query Text</div>
                  <pre className="m-0 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-100/90">
                    {activeQuery.text}
                  </pre>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/20 bg-white/8 p-4">
                  <div className="mb-2 text-sm font-semibold text-slate-100/90">Query Image</div>
                  {activeQuery.imageBase64 ? (
                    <img
                      src={buildImageSrc(activeQuery.imageBase64)}
                      alt={activeQuery.queryName || 'Query image'}
                      className="max-h-[32rem] w-full rounded-xl object-contain"
                    />
                  ) : (
                    <p className="m-0 text-sm text-slate-200/70">No image content available.</p>
                  )}
                </div>
              )}

              {activeQuery.finished && activeQuery.artificialProbability !== null && activeQuery.artificialProbability !== undefined && (
                <div className="mt-5 grid grid-cols-1 gap-2 rounded-2xl border border-white/20 bg-white/8 p-2.5 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.7fr)]">
                  <div className={`rounded-xl border p-2.5 ${getArtificialProbabilityToneClass(activeQuery.artificialProbability)}`}>
                    <div className="mb-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-slate-200/70">
                      Artificial Probability
                    </div>
                    <div className="text-lg font-bold">
                      {formatArtificialProbabilityPercent(activeQuery.artificialProbability)}
                    </div>
                  </div>
                  <div className="flex min-h-[4.25rem] flex-col justify-center rounded-xl border border-white/15 bg-white/6 p-2.5">
                    <p className="m-0 text-center text-sm leading-snug text-slate-100/90 md:text-[0.98rem]">
                      {getArtificialProbabilityInterpretation(activeQuery.artificialProbability)}
                    </p>
                  </div>
                </div>
              )}
            </section>
          ) : (
            <section className="rounded-xl border border-white/25 bg-white/4 p-6 text-slate-50">
              <p>Welcome {username}! You can submit new queries for classifying images and text. To get started, simply press the new query button on the top left.</p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}