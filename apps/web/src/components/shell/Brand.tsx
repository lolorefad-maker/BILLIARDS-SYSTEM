import { clsx } from 'clsx';
import { useT } from '../../i18n';

/** The shop's mark: a red tile with a billiard ball. Used in the side bar, the phone header and the login screen. */
export function LogoMark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <div
      className={clsx(
        'grid shrink-0 place-items-center bg-gradient-to-br from-accent to-accent-strong text-accent-fg',
        size === 'lg' ? 'size-16 rounded-2xl shadow-[0_12px_44px_-10px_var(--accent)]' : 'size-9 rounded-xl shadow-[0_6px_20px_-6px_var(--accent)]',
      )}
    >
      <svg viewBox="0 0 24 24" className={size === 'lg' ? 'size-8' : 'size-5'} fill="currentColor" aria-hidden>
        <path fillRule="evenodd" d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6Z" />
      </svg>
    </div>
  );
}

/** The shop's wordmark. Latin brand name, so it is isolated and never mirrored. */
export function Wordmark({ className }: { className?: string }) {
  const { t } = useT();
  return (
    <bdi dir="ltr" className={clsx('font-extrabold uppercase tracking-[0.14em]', className)}>
      {t('app.name')}
    </bdi>
  );
}
