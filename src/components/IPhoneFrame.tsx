interface IPhoneFrameProps {
  children: React.ReactNode;
  className?: string;
}

export function IPhoneFrame({ children, className = "" }: IPhoneFrameProps) {
  return (
    <div className={`relative ${className}`}>
      {/* iPhone outer shell */}
      <div className="relative rounded-[3rem] border-[6px] border-[#1a1a1a] bg-[#1a1a1a] shadow-2xl overflow-hidden">
        {/* Dynamic Island */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[90px] h-[28px] bg-black rounded-full" />
        
        {/* Screen content */}
        <div className="relative rounded-[2.5rem] overflow-hidden bg-background">
          {children}
        </div>
      </div>
    </div>
  );
}
