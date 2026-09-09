import {
  AnchorHTMLAttributes,
  MouseEvent,
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type RouterState = {
  pathname: string;
  search: string;
  navigate: (
    to: string,
    options?: { replace?: boolean }
  ) => void;
};

const RouterContext =
  createContext<RouterState | null>(null);

function readLocation() {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
  };
}

export function RouterProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [location, setLocation] =
    useState(readLocation);

  useEffect(() => {
    const onPopState = () =>
      setLocation(readLocation());

    window.addEventListener(
      "popstate",
      onPopState
    );

    return () =>
      window.removeEventListener(
        "popstate",
        onPopState
      );
  }, []);

  const value = useMemo<RouterState>(
    () => ({
      ...location,
      navigate(to, options) {
        if (options?.replace) {
          window.history.replaceState(
            {},
            "",
            to
          );
        } else {
          window.history.pushState(
            {},
            "",
            to
          );
        }

        setLocation(readLocation());
        window.scrollTo({
          top: 0,
          behavior: "auto",
        });
      },
    }),
    [location]
  );

  return (
    <RouterContext.Provider value={value}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  const value = useContext(RouterContext);

  if (!value) {
    throw new Error(
      "useRouter must be used inside RouterProvider"
    );
  }

  return value;
}

type LinkProps =
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string;
  };

export function Link({
  to,
  onClick,
  children,
  ...props
}: LinkProps) {
  const { navigate } = useRouter();

  function handleClick(
    event: MouseEvent<HTMLAnchorElement>
  ) {
    onClick?.(event);

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      props.target === "_blank"
    ) {
      return;
    }

    event.preventDefault();
    navigate(to);
  }

  return (
    <a
      href={to}
      onClick={handleClick}
      {...props}
    >
      {children}
    </a>
  );
}

export function Navigate({
  to,
  replace = true,
}: {
  to: string;
  replace?: boolean;
}) {
  const { navigate } = useRouter();

  useEffect(() => {
    navigate(to, { replace });
  }, [navigate, replace, to]);

  return null;
}
