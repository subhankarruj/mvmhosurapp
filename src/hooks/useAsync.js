import { useState, useCallback, useEffect, useRef } from 'react';

export function useAsync(asyncFunction, immediate = true) {
  const [status, setStatus] = useState('idle');
  const [data, setData]     = useState(null);
  const [error, setError]   = useState(null);
  const mountedRef          = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const execute = useCallback(async () => {
    setStatus('pending');
    setError(null);
    try {
      const result = await asyncFunction();
      if (mountedRef.current) { setData(result); setStatus('success'); }
      return result;
    } catch (err) {
      if (mountedRef.current) { setError(err); setStatus('error'); }
      throw err;
    }
  }, [asyncFunction]);

  useEffect(() => {
    if (immediate) execute();
  }, [execute, immediate]);

  return {
    status,
    data,
    error,
    execute,
    isLoading: status === 'pending',
    isError:   status === 'error',
    isSuccess: status === 'success',
  };
}
