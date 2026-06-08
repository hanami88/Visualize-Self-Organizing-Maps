interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

function ButtonBlack({ className = "", children, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`${className} border-black hover:bg-black hover:text-white px-[0.7rem] py-[0.3rem] border-[0.08rem] rounded-md font-medium `}
    >
      {children}
    </button>
  );
}

function ButtonBlue({ className = "", children, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`${className} px-[0.7rem] py-[0.3rem]  border-[0.08rem] rounded-md font-medium border-blue-500 bg-blue-500 text-white hover:opacity-[0.8]`}
    >
      {children}
    </button>
  );
}

export { ButtonBlue, ButtonBlack };
