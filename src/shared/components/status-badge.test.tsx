import { render, screen } from '@testing-library/react';
import i18n from '@/i18n';
import { ActiveBadge } from './status-badge';

describe('ActiveBadge', () => {
  it('renders the translated state', async () => {
    await i18n.changeLanguage('en');
    const { rerender } = render(<ActiveBadge active />);
    expect(screen.getByText('Active')).toBeInTheDocument();

    rerender(<ActiveBadge active={false} />);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });
});
