const fs = require('fs');
let content = fs.readFileSync('client/src/layouts/MainLayout.tsx', 'utf8');

// 1. Remove state variable
content = content.replace(
  "    const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);\n",
  ""
);

// 2. Add Trash to navItems
const oldNavItems = `      { name: 'Reports', path: '/reports', icon: <BarChart3 size={20} />, isPro: true },
      { name: 'Payments', path: '/payments', icon: <WalletCards size={20} />, isPro: true },
      { name: 'Settings', path: '/settings', icon: <Settings size={20} /> },
      { name: 'About', path: '/about', icon: <Info size={20} /> },`;
const newNavItems = `      { name: 'Reports', path: '/reports', icon: <BarChart3 size={20} />, isPro: true },
      { name: 'Payments', path: '/payments', icon: <WalletCards size={20} />, isPro: true },
      { name: 'Settings', path: '/settings', icon: <Settings size={20} /> },
      { name: 'About', path: '/about', icon: <Info size={20} /> },
      { name: 'Trash', path: '/trash', icon: <Trash2 size={20} /> },`;
content = content.replace(oldNavItems, newNavItems);

// 3. Remove SubscriptionModal import
content = content.replace(
  "import SubscriptionModal from '../components/ui/SubscriptionModal';\n",
  ""
);

// 4. Remove SubscriptionModal usage (using simple split and slice because the block is at the end)
// We know it is right before "</div>\n    );\n  };\n  \n  export default MainLayout;"
content = content.replace(
  /\s*<SubscriptionModal[\s\S]*?isOpen=\{isSubscriptionModalOpen\}[\s\S]*?\/>/,
  ''
);

fs.writeFileSync('client/src/layouts/MainLayout.tsx', content);
