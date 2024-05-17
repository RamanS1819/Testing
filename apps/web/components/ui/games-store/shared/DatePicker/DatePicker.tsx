import { ReactNode, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/games-store/shared/Button';
import { DateItem } from '@/components/ui/games-store/shared/DatePicker/DateItem';
import { clsx } from 'clsx';

export const DatePicker = ({
  trigger,
  setDateFrom,
  setDateTo,
}: {
  trigger: ReactNode;
  setDateFrom: (date: string) => void;
  setDateTo: (date: string) => void;
}) => {
  const [currentDate, _setCurrentDate] = useState<Date>(new Date());
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const [activeDate, setActiveDate] = useState<Date | undefined>(undefined);
  const [possibleDate, setPossibleDate] = useState<Date | undefined>(undefined);
  const [pickedDate, setPickedDate] = useState<Date | undefined>(undefined);
  const [_currentMonth, setCurrentMonth] = useState<number>(
    currentDate.getMonth()
  );

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  const getLastDayOfMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const clearDates = () => {
    setDateTo('');
    setDateFrom('');
    setActiveDate(undefined);
    setPossibleDate(undefined);
    setPickedDate(undefined);
  };

  return (
    <div className={'relative flex flex-col'}>
      <button
        type={'button'}
        className={'cursor-pointer'}
        onClick={() => setIsOpen(true)}
      >
        {trigger}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
            className={
              'fixed left-0 top-0 z-10 flex h-full w-full items-center justify-center backdrop-blur-sm'
            }
            onClick={() => setIsOpen(false)}
          >
            <div
              className={
                'flex flex-col gap-8 rounded-[5px] border border-left-accent bg-bg-dark p-12'
              }
              onClick={(e) => e.stopPropagation()}
            >
              <div className={'flex w-full flex-row justify-between'}>
                <div
                  className={clsx(
                    'flex w-full max-w-[30%] cursor-pointer  items-center justify-start',
                    {
                      'cursor-not-allowed opacity-50':
                        currentDate.getMonth() == new Date().getMonth(),
                      'hover:opacity-80':
                        currentDate.getMonth() != new Date().getMonth(),
                    }
                  )}
                  onClick={
                    currentDate.getMonth() != new Date().getMonth()
                      ? () => {
                          clearDates();
                          setCurrentMonth(
                            currentDate.setMonth(currentDate.getMonth() - 1)
                          );
                        }
                      : undefined
                  }
                >
                  <svg
                    width="9"
                    height="18"
                    viewBox="0 0 6 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M5 11L1 6L5 1"
                      stroke="#D2FF00"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div
                  className={
                    'w-full text-center text-[18px]/[18px] font-medium'
                  }
                >
                  {currentDate
                    .toLocaleDateString('en-US', {
                      dateStyle: 'long',
                    })
                    .split(' ')
                    .map((item, index) => (index === 1 ? ' ' : item))}
                </div>
                <div
                  className={
                    'flex w-full max-w-[30%] cursor-pointer items-center justify-end hover:opacity-80'
                  }
                  onClick={() => {
                    clearDates();
                    setCurrentMonth(
                      currentDate.setMonth(currentDate.getMonth() + 1)
                    );
                  }}
                >
                  <svg
                    width="9"
                    height="18"
                    viewBox="0 0 6 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M1 11L5 6L1 1"
                      stroke="#D2FF00"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
              <div
                className={'grid h-full w-full grid-cols-7 grid-rows-5 gap-y-1'}
              >
                <span className="rounded-[5px] p-4 text-center font-plexsans text-[15px]/[15px] font-[900] text-left-accent">
                  S
                </span>
                <span className="rounded-[5px] p-4 text-center font-plexsans text-[15px]/[15px] font-[900] text-left-accent">
                  M
                </span>
                <span className="rounded-[5px] p-4 text-center font-plexsans text-[15px]/[15px] font-[900] text-left-accent">
                  T
                </span>
                <span className="rounded-[5px] p-4 text-center font-plexsans text-[15px]/[15px] font-[900] text-left-accent">
                  W
                </span>
                <span className="rounded-[5px] p-4 text-center font-plexsans text-[15px]/[15px] font-[900] text-left-accent">
                  T
                </span>
                <span className="rounded-[5px] p-4 text-center font-plexsans text-[15px]/[15px] font-[900] text-left-accent">
                  F
                </span>
                <span className="rounded-[5px] p-4 text-center font-plexsans text-[15px]/[15px] font-[900] text-left-accent">
                  S
                </span>
                {[
                  ...Array(
                    getDaysInMonth(
                      currentDate.getFullYear(),
                      currentDate.getMonth() + 1
                    )
                  ),
                ].map((_, index) => (
                  <DateItem
                    key={index}
                    date={
                      new Date(
                        currentDate.getFullYear(),
                        currentDate.getMonth(),
                        index + 1
                      )
                    }
                    activeDateTime={activeDate?.getTime()}
                    pickedDateTime={pickedDate?.getTime()}
                    possibleDateTime={possibleDate?.getTime()}
                    activeDate={activeDate}
                    pickedDate={pickedDate}
                    setDateTo={setDateTo}
                    setDateFrom={setDateFrom}
                    setActiveDate={setActiveDate}
                    setPickedDate={setPickedDate}
                    setPossibleDate={setPossibleDate}
                  />
                ))}
              </div>
              <div className={'flex w-full flex-row justify-between'}>
                <Button
                  type={'button'}
                  label={'Cancel'}
                  onClick={() => setIsOpen(false)}
                  isFilled={false}
                  isBordered={false}
                />
                <div className={'w-full'} />
                <Button
                  type={'button'}
                  label={'Done'}
                  onClick={() => setIsOpen(false)}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
