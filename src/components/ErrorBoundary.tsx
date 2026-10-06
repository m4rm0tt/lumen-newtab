import { Component, type ComponentChildren } from 'preact';

interface Props {
  children: ComponentChildren;
  fallback: (error: Error, reset: () => void) => ComponentChildren;
}

/** Isole une zone : une erreur dans un widget ne casse jamais le reste de la page. */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  override state = { error: null as Error | null };

  override componentDidCatch(error: Error) {
    this.setState({ error });
  }

  reset = () => this.setState({ error: null });

  override render() {
    return this.state.error ? this.props.fallback(this.state.error, this.reset) : this.props.children;
  }
}
