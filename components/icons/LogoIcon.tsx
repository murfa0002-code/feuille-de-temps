import React from 'react';

const LogoIcon: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = (props) => {
  return (
    <img 
      src="https://media.licdn.com/dms/image/v2/C4E0BAQHS97Kz9UT7QQ/company-logo_200_200/company-logo_200_200/0/1630636806275/lgmc_mutandis_logo?e=2147483647&v=beta&t=EaVWLwsYBf6MUv1A3iQFZahHEYgycBvnqWCbHAv7SaM"
      alt="LGMC- MUTANDIS Logo"
      {...props}
    />
  );
};

export default LogoIcon;
